import {
  getTeamRoster,
  getUConnTeamInfo,
  getPlayerStats,
  getTeamSchedule,
  getGameSummary,
} from "@/lib/espn-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import Image from "next/image";

export const revalidate = 86400; // Revalidate every 24 hours

export default async function PlayersPage() {
  const rosterData = await getTeamRoster();
  const teamInfo = await getUConnTeamInfo();
  const team = teamInfo?.team;
  const athletes = rosterData?.athletes || [];
  const today = new Date();
  const seasonEndYear = today.getMonth() >= 6 ? today.getFullYear() + 1 : today.getFullYear();
  const seasonLabel = `${seasonEndYear - 1}-${seasonEndYear.toString().slice(-2)}`;

  // Fetch schedule to aggregate completed game stats
  const schedule = await getTeamSchedule(seasonEndYear.toString());
  const completedGameIds =
    schedule?.events
      ?.filter((event: any) => event.competitions?.[0]?.status?.type?.completed)
      .map((event: any) => event.id)
      .filter(Boolean) || [];

  // Aggregate per-player totals from completed game summaries
  const aggregateTotals: Record<
    string,
    {
      games: number;
      pts: number;
      reb: number;
      ast: number;
      stl: number;
      blk: number;
      tov: number;
      fgm: number;
      fga: number;
      tpm: number;
      tpa: number;
      ftm: number;
      fta: number;
      mins: number;
    }
  > = {};

  const parseNum = (val: any) => {
    if (val === null || val === undefined || val === "") return null;
    const num = Number(val);
    return Number.isFinite(num) ? num : null;
  };

  const summaries = await Promise.all(
    completedGameIds.map(async (id: string) => {
      try {
        const data = await getGameSummary(id);
        return data;
      } catch {
        return null;
      }
    })
  );

  summaries.forEach((summary) => {
    if (!summary?.boxscore?.players) return;
    const uconn = summary.boxscore.players.find(
      (p: any) => p.team?.id === team?.id || p.team?.id === "41"
    );
    const statCategory = uconn?.statistics?.[0];
    const statKeys: string[] = statCategory?.keys || [];
    const athletesStats = statCategory?.athletes || [];

    athletesStats.forEach((ath: any) => {
      const statsArr = ath.stats || [];
      const statsMap: Record<string, any> = {};
      if (Array.isArray(statsArr) && statKeys.length === statsArr.length) {
        statKeys.forEach((k, i) => {
          statsMap[k] = statsArr[i];
        });
      }
      const id = ath.athlete?.id;
      if (!id) return;
      if (!aggregateTotals[id]) {
        aggregateTotals[id] = {
          games: 0,
          pts: 0,
          reb: 0,
          ast: 0,
          stl: 0,
          blk: 0,
          tov: 0,
          fgm: 0,
          fga: 0,
          tpm: 0,
          tpa: 0,
          ftm: 0,
          fta: 0,
          mins: 0,
        };
      }
      const agg = aggregateTotals[id];
      agg.games += 1;
      agg.pts += parseNum(statsMap.points) || 0;
      agg.reb += parseNum(statsMap.rebounds) || 0;
      agg.ast += parseNum(statsMap.assists) || 0;
      agg.stl += parseNum(statsMap.steals) || 0;
      agg.blk += parseNum(statsMap.blocks) || 0;
      agg.tov += parseNum(statsMap.turnovers) || 0;

      const fgParts = (statsMap["fieldGoalsMade-fieldGoalsAttempted"] || "").split("-");
      if (fgParts.length === 2) {
        agg.fgm += parseNum(fgParts[0]) || 0;
        agg.fga += parseNum(fgParts[1]) || 0;
      }
      const threeParts = (statsMap["threePointFieldGoalsMade-threePointFieldGoalsAttempted"] || "").split("-");
      if (threeParts.length === 2) {
        agg.tpm += parseNum(threeParts[0]) || 0;
        agg.tpa += parseNum(threeParts[1]) || 0;
      }
      const ftParts = (statsMap["freeThrowsMade-freeThrowsAttempted"] || "").split("-");
      if (ftParts.length === 2) {
        agg.ftm += parseNum(ftParts[0]) || 0;
        agg.fta += parseNum(ftParts[1]) || 0;
      }
      agg.mins += parseNum(statsMap.minutes) || 0;
    });
  });

  // Fetch per-player season stats (best effort)
  const playerStatsEntries = await Promise.all(
    athletes.map(async (ath: any) => {
      try {
        const stats = await getPlayerStats(ath.id, {
          teamId: ath.team?.id || team?.id || "41",
          season: seasonEndYear,
        });
        return { id: ath.id, stats };
      } catch (err) {
        return { id: ath.id, stats: null };
      }
    })
  );
  const playerStatsMap = playerStatsEntries.reduce<Record<string, any>>(
    (acc, entry) => {
      if (entry.stats) acc[entry.id] = entry.stats;
      return acc;
    },
    {}
  );

  const groupedByPosition: Record<string, any[]> = {};
  athletes.forEach((athlete: any) => {
    const position = athlete.position?.abbreviation || "N/A";
    if (!groupedByPosition[position]) {
      groupedByPosition[position] = [];
    }
    groupedByPosition[position].push(athlete);
  });

  return (
    <main className="min-h-screen p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center gap-4 mb-8 mt-8">
        <Users className="h-12 w-12 text-primary" />
        <h1 className="text-5xl font-bold text-primary">Team Roster</h1>
      </div>

      <p className="text-xl text-muted-foreground mb-8">
        Current Season {seasonLabel}
      </p>

      <div className="space-y-8">
        {Object.keys(groupedByPosition)
          .sort()
          .map((position) => (
            <div key={position}>
              <h2 className="text-3xl font-bold mb-4">
                {position === "G"
                  ? "Guards"
                  : position === "F"
                  ? "Forwards"
                  : position === "C"
                  ? "Centers"
                  : `Position: ${position}`}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedByPosition[position].map((player: any) => {
                  const heightDisplay =
                    player.displayHeight ||
                    (typeof player.height === "number"
                      ? (() => {
                          const totalInches = player.height;
                          const feet = Math.floor(totalInches / 12);
                          const inches = Math.round(totalInches % 12);
                          return `${feet}' ${inches}"`;
                        })()
                      : typeof player.height === "string"
                      ? player.height
                      : null);

                  // Merge inline roster stats with fetched season stats
                  const inlineStats =
                    player.statistics?.[0]?.stats ??
                    player.statistics?.[0]?.splits?.categories?.flatMap(
                      (cat: any) => cat.stats || []
                    ) ??
                    [];

                  const fetchedStats =
                    playerStatsMap[player.id]?.categories
                      ?.flatMap((cat: any) => cat.stats || [])
                      ?.concat(
                        playerStatsMap[player.id]?.splits?.categories?.flatMap(
                          (cat: any) => cat.stats || []
                        ) || []
                      ) || [];

                  const allStats = [...inlineStats, ...fetchedStats];

                  const getStat = (...keys: string[]) => {
                    const stat = allStats.find((s: any) =>
                      keys.includes(s.name)
                    );
                    return stat?.displayValue || stat?.value || null;
                  };

                  const formatPct = (val: any) => {
                    if (val === null || val === undefined || val === "") return null;
                    const num = Number(val);
                    if (Number.isFinite(num)) {
                      return `${num}%`;
                    }
                    return String(val);
                  };

                  const agg = aggregateTotals[player.id];
                  const gpFromAgg = agg?.games || null;
                  const avg = (val: number | undefined, games: number | null) =>
                    games && games > 0 ? (val || 0) / games : null;
                  const pct = (made: number | undefined, att: number | undefined) =>
                    made !== undefined &&
                    att !== undefined &&
                    att !== 0 &&
                    made !== null &&
                    att !== null
                      ? `${((made / att) * 100).toFixed(1)}%`
                      : null;

                  const formatValue = (
                    val: any,
                    opts: { int?: boolean; decimals?: number } = {}
                  ) => {
                    if (val === null || val === undefined || val === "") return "—";
                    const num = Number(val);
                    if (!Number.isFinite(num)) return String(val);
                    if (opts.int) return Math.round(num).toString();
                    const d = opts.decimals ?? 1;
                    return num.toFixed(d).replace(/\.0+$/, "");
                  };

                  const stats = {
                    ppg:
                      avg(agg?.pts, gpFromAgg) ??
                      getStat("avgPoints", "pointsPerGame", "ppg", "points"),
                    rpg:
                      avg(agg?.reb, gpFromAgg) ??
                      getStat("avgRebounds", "reboundsPerGame", "rpg", "rebounds"),
                    apg:
                      avg(agg?.ast, gpFromAgg) ??
                      getStat("avgAssists", "assistsPerGame", "apg", "assists"),
                    mpg:
                      avg(agg?.mins, gpFromAgg) ??
                      getStat("avgMinutes", "minutesPerGame", "mpg", "minutes"),
                    gp: gpFromAgg ?? getStat("gamesPlayed", "games", "appearances"),
                    spg:
                      avg(agg?.stl, gpFromAgg) ??
                      getStat("avgSteals", "stealsPerGame", "spg", "steals"),
                    bpg:
                      avg(agg?.blk, gpFromAgg) ??
                      getStat("avgBlocks", "blocksPerGame", "bpg", "blocks"),
                    fg:
                      pct(agg?.fgm, agg?.fga) ??
                      formatPct(getStat("fieldGoalPct", "fgPct")),
                    three:
                      pct(agg?.tpm, agg?.tpa) ??
                      formatPct(getStat("threePointPct", "threePointFieldGoalPct", "threePct", "3PtPct")),
                    ft:
                      pct(agg?.ftm, agg?.fta) ??
                      formatPct(getStat("freeThrowPct", "ftPct")),
                  };

                  const statEntries = [
                    { label: "PPG", value: formatValue(stats.ppg) },
                    { label: "RPG", value: formatValue(stats.rpg) },
                    { label: "APG", value: formatValue(stats.apg) },
                    { label: "MPG", value: formatValue(stats.mpg) },
                    { label: "GP", value: formatValue(stats.gp, { int: true }) },
                    { label: "SPG", value: formatValue(stats.spg) },
                    { label: "BPG", value: formatValue(stats.bpg) },
                    { label: "FG%", value: stats.fg ?? "—" },
                    { label: "3P%", value: stats.three ?? "—" },
                    { label: "FT%", value: stats.ft ?? "—" },
                  ].filter((s) => s.value !== null && s.value !== undefined && s.value !== "");

                  return (
                    <Card key={player.id} className="hover:border-primary transition-colors">
                      <CardHeader>
                        <div className="flex items-start gap-4">
                          {player.headshot?.href ? (
                            <Image
                              src={player.headshot.href}
                              alt={player.displayName}
                              width={80}
                              height={80}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                              <Users className="h-10 w-10 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1">
                            <CardTitle className="text-2xl mb-2">
                              {player.displayName}
                            </CardTitle>
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant="outline">
                                #{player.jersey || "?"}
                              </Badge>
                              <Badge variant="secondary">
                                {player.position?.abbreviation || "N/A"}
                              </Badge>
                              {player.experience?.displayValue && (
                                <Badge variant="outline">
                                  {player.experience.displayValue}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-lg">
                          {heightDisplay && (
                            <p className="text-muted-foreground">
                              Height:{" "}
                              <span className="font-semibold text-foreground">
                                {heightDisplay}
                              </span>
                            </p>
                          )}
                          {player.displayWeight && (
                            <p className="text-muted-foreground">
                              Weight: <span className="font-semibold text-foreground">{player.displayWeight}</span>
                            </p>
                          )}
                          {player.age && (
                            <p className="text-muted-foreground">
                              Age: <span className="font-semibold text-foreground">{player.age}</span>
                            </p>
                          )}
                          {player.experience && (
                            <p className="text-muted-foreground">
                              Year: <span className="font-semibold text-foreground capitalize">{player.experience.displayValue}</span>
                            </p>
                          )}
                          {player.birthPlace?.city && (
                            <p className="text-muted-foreground">
                              Hometown:{" "}
                              <span className="font-semibold text-foreground">
                                {player.birthPlace.city}
                                {player.birthPlace.state && `, ${player.birthPlace.state}`}
                              </span>
                            </p>
                          )}
                          {Array.isArray(player.injuries) && player.injuries.length > 0 && (
                            <div className="text-muted-foreground">
                              <p className="font-semibold text-foreground mb-1">Injury Report</p>
                              <ul className="space-y-1 text-sm">
                                {player.injuries.map((injury: any, idx: number) => (
                                  <li key={idx}>
                                    <span className="font-semibold text-foreground">
                                      {injury.type?.displayName || "Status"}:
                                    </span>{" "}
                                    {injury.status || "N/A"}{" "}
                                    {injury.detail && <span>— {injury.detail}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {statEntries.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
                            {statEntries.map((s) => (
                              <div
                                key={s.label}
                                className="rounded-lg bg-muted/40 p-3 text-center"
                              >
                                <p className="text-xs font-semibold text-muted-foreground tracking-wide">
                                  {s.label}
                                </p>
                                <p className="text-2xl font-semibold text-foreground">
                                  {s.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
      </div>

      {athletes.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-2xl text-muted-foreground">
              No roster data available
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
