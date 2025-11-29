"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { getGameSummary } from "@/lib/espn-api";

const getCurrentSeasonYear = () => {
  const today = new Date();
  // NCAA season spans fall-spring; before July we are still in the prior season
  return today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
};

export default function HistoryPage() {
  const currentSeasonYear = getCurrentSeasonYear();
  const [selectedYear, setSelectedYear] = useState(currentSeasonYear);
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<Record<string, any>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [scoreboardPlayers, setScoreboardPlayers] = useState<
    Record<string, Record<string, any[]>>
  >({});
  const [scoreboardLoading, setScoreboardLoading] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => currentSeasonYear - i);

  const fetchSchedule = async (year: number) => {
    setLoading(true);
    setSchedule(null);
    try {
      const seasonParam = year + 1; // ESPN season param is the end year
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/41/schedule?season=${seasonParam}`
      );
      if (!response.ok) {
        setSchedule({ events: [] });
        return;
      }
      const data = await response.json();
      setSchedule(data ?? { events: [] });
    } catch (error) {
      console.error("Error fetching schedule:", error);
      setSchedule({ events: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule(selectedYear);
  }, [selectedYear]);

  // Fetch per-game summaries (boxscore stats)
  useEffect(() => {
    const loadSummaries = async () => {
      const events = schedule?.events || [];
      const completed = events.filter(
        (event: any) => event.competitions?.[0]?.status?.type?.completed
      );
      const idsToFetch = completed
        .map((e: any) => e.id)
        .filter((id: string) => id && !summaries[id]);
      if (idsToFetch.length === 0) return;
      setSummaryLoading(true);
      try {
        const results = await Promise.all(
          idsToFetch.map(async (id: string) => {
            try {
              const data = await getGameSummary(id);
              return { id, data };
            } catch (e) {
              console.error("Error fetching summary", id, e);
              return null;
            }
          })
        );
        const next = { ...summaries };
        results.forEach((res) => {
          if (res?.id && res.data) {
            next[res.id] = res.data;
          }
        });
        setSummaries(next);
      } finally {
        setSummaryLoading(false);
      }
    };
    loadSummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

  // Fetch scoreboard data by date to capture player stats if summaries are missing
  useEffect(() => {
    const loadScoreboards = async () => {
      const events = schedule?.events || [];
      const completed = events.filter(
        (event: any) => event.competitions?.[0]?.status?.type?.completed
      );
      const dates = Array.from(
        new Set(
          completed
            .map((e: any) => e.date)
            .filter(Boolean)
            .map((d: string) => {
              const dt = new Date(d);
              const yyyy = dt.getUTCFullYear();
              const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
              const dd = String(dt.getUTCDate()).padStart(2, "0");
              return `${yyyy}${mm}${dd}`;
            })
        )
      );

      const neededDates = dates.filter((d) => !scoreboardPlayers[`date:${d}`]);
      if (neededDates.length === 0) return;
      setScoreboardLoading(true);
      try {
        const results = await Promise.all(
          neededDates.map(async (date) => {
            try {
              const res = await fetch(
                `https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard?dates=${date}&limit=300`,
                { cache: "no-store" }
              );
              if (!res.ok) return null;
              const data = await res.json();
              return { date, data };
            } catch {
              return null;
            }
          })
        );

        const next = { ...scoreboardPlayers };
        results.forEach((res) => {
          if (!res?.data?.events) return;
          const mapByGame: Record<string, Record<string, any[]>> = {};
          res.data.events.forEach((ev: any) => {
            const comp = ev.competitions?.[0];
            const athletes = comp?.athletes || [];
            athletes.forEach((ath: any) => {
              const teamId = ath.team?.id;
              if (!teamId || !ev.id) return;
              if (!mapByGame[ev.id]) mapByGame[ev.id] = {};
              if (!mapByGame[ev.id][teamId]) mapByGame[ev.id][teamId] = [];
              mapByGame[ev.id][teamId].push(ath);
            });
          });
          next[`date:${res.date}`] = mapByGame;
          // Also flatten gameId -> team map for quick lookup
          Object.entries(mapByGame).forEach(([gameId, teams]) => {
            next[gameId] = teams;
          });
        });
        setScoreboardPlayers(next);
      } finally {
        setScoreboardLoading(false);
      }
    };
    loadScoreboards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

  const games = (schedule?.events || []).filter(
    (event: any) => event.season?.year === selectedYear + 1
  );
  const completedGames = games.filter(
    (event: any) => event.competitions?.[0]?.status?.type?.completed
  );
  const upcomingGames = games.filter(
    (event: any) => !event.competitions?.[0]?.status?.type?.completed
  );

  const getGameResult = (event: any) => {
    const summary = summaries[event.id];
    const boxTeams = summary?.boxscore?.teams;
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors || [];
    const uconnTeam = competitors.find((c: any) => c.team?.id === "41");
    const opponent = competitors.find((c: any) => c.team?.id !== "41");

    if (!competition || !uconnTeam || !opponent) return null;

    const extractScore = (team: any, boxTeam?: any) => {
      const score = boxTeam?.score ?? team.score;
      if (!score) return { num: null, display: null };
      if (typeof score === "object") {
        const num =
          typeof score.value === "number"
            ? score.value
            : typeof score.displayValue === "string"
            ? Number(score.displayValue)
            : null;
        const display =
          typeof score.displayValue === "string"
            ? score.displayValue
            : typeof score.value === "number"
            ? String(score.value)
            : null;
        return { num: Number.isFinite(num) ? num : null, display };
      }
      if (typeof score === "number" || typeof score === "string") {
        const num = Number(score);
        return {
          num: Number.isFinite(num) ? num : null,
          display: String(score),
        };
      }
      return { num: null, display: null };
    };

    const boxUconn = boxTeams?.find((t: any) => t.team?.id === "41");
    const boxOpp = boxTeams?.find((t: any) => t.team?.id === opponent?.team?.id);

    const uScore = extractScore(uconnTeam, boxUconn);
    const oScore = extractScore(opponent, boxOpp);
    const hasScores = Boolean(uScore.display && oScore.display);

    let outcome: "win" | "loss" | "unknown" = "unknown";
    if (typeof uconnTeam.winner === "boolean") {
      outcome = uconnTeam.winner ? "win" : "loss";
    } else if (hasScores && uScore.num !== null && oScore.num !== null) {
      outcome = uScore.num > oScore.num ? "win" : "loss";
    }

    return {
      outcome,
      hasScores,
      uconnScore: hasScores ? uScore.display : null,
      opponentScore: hasScores ? oScore.display : null,
      opponent: opponent.team,
      homeAway: uconnTeam.homeAway,
      date: event.date,
      boxTeams,
      boxPlayers: summary?.boxscore?.players,
    };
  };

  const normalizeSummaryPlayers = (eventId: string, teamId: string) => {
    const summary = summaries[eventId];
    const container = summary?.boxscore?.players?.find(
      (p: any) => p.team?.id === teamId
    );
    const statCategory = container?.statistics?.[0];
    const statKeys: string[] = statCategory?.keys || [];
    const athleteStats =
      statCategory?.athletes ||
      container?.athletes ||
      container?.players ||
      [];

    const normalize = (ath: any) => {
      const statsArr =
        ath?.stats ||
        ath?.statistics ||
        ath?.athlete?.stats ||
        [];

      // Convert stat arrays (strings) into a keyed object using statKeys
      const statsObj: Record<string, any> = {};
      if (Array.isArray(statsArr) && statKeys.length === statsArr.length) {
        statKeys.forEach((key, idx) => {
          statsObj[key] = statsArr[idx];
        });
      } else if (Array.isArray(statsArr)) {
        statsArr.forEach((val: any, idx: number) => {
          statsObj[String(idx)] = val;
        });
      }

      const getStat = (...keys: string[]) => {
        for (const k of keys) {
          if (statsObj[k] !== undefined && statsObj[k] !== null) {
            return statsObj[k];
          }
        }
        return null;
      };

      return {
        id: ath?.athlete?.id || ath?.id || ath?.uid || ath?.name,
        name: ath?.athlete?.displayName || ath?.displayName || ath?.name,
        starter: ath?.starter,
        position:
          ath?.position?.abbreviation ||
          ath?.athlete?.position?.abbreviation ||
          "",
        mins: getStat("minutes", "MIN"),
        pts: getStat("points", "PTS"),
        reb: getStat("rebounds", "REB", "totalRebounds"),
        ast: getStat("assists", "AST"),
        fg: getStat("fieldGoalsMade-fieldGoalsAttempted"),
        three: getStat("threePointFieldGoalsMade-threePointFieldGoalsAttempted"),
      };
    };

    return athleteStats.map(normalize).filter((p: any) => p.name);
  };

  const normalizeScoreboardPlayers = (eventId: string, teamId: string) => {
    const teamMap = scoreboardPlayers[eventId];
    const players = teamMap?.[teamId] || [];
    const normalize = (ath: any) => {
      const statsRaw = ath.stats || ath.statistics || {};
      const getStat = (keys: string[]) => {
        if (Array.isArray(statsRaw)) {
          return null;
        }
        for (const k of keys) {
          if (statsRaw[k] !== undefined && statsRaw[k] !== null) {
            return statsRaw[k];
          }
        }
        return null;
      };

      return {
        id: ath?.athlete?.id || ath?.id || ath?.uid || ath?.name,
        name: ath?.athlete?.displayName || ath?.displayName || ath?.name,
        mins: getStat(["minutes", "MIN"]),
        pts: getStat(["points", "PTS"]),
        reb: getStat(["rebounds", "REB", "totalRebounds"]),
        ast: getStat(["assists", "AST"]),
        fg: getStat([
          "fieldGoalsMade-fieldGoalsAttempted",
          "fgm-fga",
          "fg",
        ]),
        three: getStat([
          "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
          "3ptm-3pta",
          "threePt",
        ]),
      };
    };

    return players.map(normalize).filter((p: any) => p.name);
  };

  const getPlayerLines = (eventId: string, teamId: string) => {
    const fromSummary = normalizeSummaryPlayers(eventId, teamId);
    if (fromSummary.length > 0) return fromSummary;
    const fromScoreboard = normalizeScoreboardPlayers(eventId, teamId);
    return fromScoreboard;
  };

  const completedResults = completedGames
    .map((g: any) => ({ event: g, result: getGameResult(g) }))
    .filter((pair: any) => pair.result);

  const wins = completedResults.filter((p: any) => p.result.outcome === "win")
    .length;
  const losses = completedResults.filter(
    (p: any) => p.result.outcome === "loss"
  ).length;
  const decidedTotal = wins + losses;

  return (
    <main className="min-h-screen p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center gap-4 mb-8 mt-8">
        <Calendar className="h-12 w-12 text-primary" />
        <h1 className="text-5xl font-bold text-primary">Game History</h1>
      </div>

      {/* Year Selector */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <Button
          variant="outline"
          size="lg"
          onClick={() =>
            setSelectedYear((y) => Math.max(y - 1, currentSeasonYear - 4))
          }
          disabled={selectedYear <= currentSeasonYear - 4}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="text-center min-w-[200px]">
          <p className="text-4xl font-bold text-primary">
            {selectedYear}-{(selectedYear + 1).toString().slice(-2)}
          </p>
          <p className="text-lg text-muted-foreground">Season</p>
        </div>
        <Button
          variant="outline"
          size="lg"
          onClick={() =>
            setSelectedYear((y) => Math.min(y + 1, currentSeasonYear))
          }
          disabled={selectedYear >= currentSeasonYear}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Record Summary */}
      {!loading && decidedTotal > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Wins</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-5xl font-bold text-green-600">{wins}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Losses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-5xl font-bold text-red-600">{losses}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-xl text-muted-foreground">Loading schedule...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Completed Games */}
          {completedGames.length > 0 && (
            <div>
              <h2 className="text-3xl font-bold mb-6">Completed Games</h2>
              <div className="space-y-4">
                {[...completedGames].reverse().map((event: any) => {
                  const result = getGameResult(event);
                  if (!result) return null;

                  return (
                    <Card
                      key={event.id}
                      className={
                        result.outcome === "win"
                          ? "border-green-500/50"
                          : result.outcome === "loss"
                          ? "border-red-500/50"
                          : "border-border"
                      }
                    >
                      <CardHeader>
                        <div className="flex flex-col gap-2">
                          <span className="text-muted-foreground text-base">
                            {new Date(event.date).toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-3">
                              <Badge
                                variant={
                                  result.outcome === "win"
                                    ? "default"
                                    : result.outcome === "loss"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {result.outcome === "win"
                                  ? "W"
                                  : result.outcome === "loss"
                                  ? "L"
                                  : "TBD"}
                              </Badge>
                              <Badge variant="outline">
                                {result.homeAway === "home" ? "HOME" : "AWAY"}
                              </Badge>
                              <CardTitle className="text-2xl">
                                vs {result.opponent.displayName}
                              </CardTitle>
                            </div>
                            <div className="md:text-right md:min-w-[140px]">
                              {result.hasScores ? (
                                <div className="text-3xl font-bold md:text-4xl">
                                  {result.uconnScore} - {result.opponentScore}
                                </div>
                              ) : (
                                <div className="text-lg text-muted-foreground">
                                  Score unavailable
                                </div>
                              )}
                            </div>
                          </div>

                          {result.boxTeams && (
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              {result.boxTeams.map((teamBox: any) => {
                                const stats = teamBox.statistics || [];
                                const lookup = (names: string[]) => {
                                  const found = stats.find((s: any) =>
                                    names.includes(s.name)
                                  );
                                  return found?.displayValue ?? found?.value ?? "—";
                                };
                                return (
                                  <div
                                    key={teamBox.team?.id}
                                    className="rounded-lg border border-border/60 p-3"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-semibold text-foreground">
                                        {teamBox.team?.abbreviation || teamBox.team?.displayName}
                                      </span>
                                      <Badge variant="outline">
                                        {teamBox.homeAway?.toUpperCase() || ""}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                                      <span>FG%: {lookup(["fieldGoalPct", "fgPct"])}</span>
                                      <span>3P%: {lookup(["threePointFieldGoalPct", "threePointPct", "3PtPct"])}</span>
                                      <span>FT%: {lookup(["freeThrowPct", "ftPct"])}</span>
                                      <span>REB: {lookup(["totalRebounds"])}</span>
                                      <span>AST: {lookup(["assists"])}</span>
                                      <span>TO: {lookup(["turnovers", "totalTurnovers"])}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {result.boxPlayers && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {[event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === "home"), event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === "away")].map((team) => {
                                if (!team?.team?.id) return null;
                                const players = getPlayerLines(
                                  event.id,
                                  team.team.id
                                );
                                if (!players || players.length === 0) return null;
                                const topPlayers = [...players].sort(
                                  (a: any, b: any) =>
                                    (Number(b.pts) || 0) - (Number(a.pts) || 0)
                                );
                                return (
                                  <div
                                    key={team.team.id}
                                    className="rounded-lg border border-border/60 p-3"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-semibold text-foreground">
                                        {team.team.abbreviation}
                                      </span>
                                      <Badge variant="outline">
                                        {team.homeAway?.toUpperCase()}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2 text-muted-foreground text-xs font-semibold mb-1">
                                      <span>Player</span>
                                      <span className="text-center">PTS</span>
                                      <span className="text-center">REB</span>
                                      <span className="text-center">AST</span>
                                      <span className="text-center">MIN</span>
                                    </div>
                                    <div className="space-y-1">
                                      {topPlayers.map((p: any) => (
                                        <div
                                          key={p.id}
                                          className="grid grid-cols-5 gap-2 items-center"
                                        >
                                          <span className="truncate text-foreground">
                                            {p.name}
                                          </span>
                                          <span className="text-center">
                                            {p.pts ?? "—"}
                                          </span>
                                          <span className="text-center">
                                            {p.reb ?? "—"}
                                          </span>
                                          <span className="text-center">
                                            {p.ast ?? "—"}
                                          </span>
                                          <span className="text-center">
                                            {p.mins ?? "—"}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Games */}
          {upcomingGames.length > 0 && (
            <div>
              <h2 className="text-3xl font-bold mb-6">Upcoming Games</h2>
              <div className="space-y-4">
                {upcomingGames.map((event: any) => {
                  const competition = event.competitions[0];
                  const uconnTeam = competition.competitors.find(
                    (c: any) => c.team.id === "41"
                  );
                  const opponent = competition.competitors.find(
                    (c: any) => c.team.id !== "41"
                  );

                  if (!opponent) return null;

                  return (
                    <Card key={event.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge variant="outline" className="mb-2">
                              {uconnTeam?.homeAway === "home" ? "HOME" : "AWAY"}
                            </Badge>
                            <CardTitle className="text-2xl">
                              vs {opponent.team.displayName}
                            </CardTitle>
                            <p className="text-lg text-muted-foreground mt-1">
                              {new Date(event.date).toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {games.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-2xl text-muted-foreground">
                  No games found for this season
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}
