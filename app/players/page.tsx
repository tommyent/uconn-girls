import { getTeamRoster, getUConnTeamInfo } from "@/lib/espn-api";
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

                  const allStats =
                    player.statistics?.[0]?.stats ??
                    player.statistics?.[0]?.splits?.categories?.flatMap(
                      (cat: any) => cat.stats || []
                    ) ??
                    [];

                  const getStat = (...keys: string[]) => {
                    const stat = allStats.find((s: any) =>
                      keys.includes(s.name)
                    );
                    return stat?.displayValue || stat?.value || null;
                  };

                  const stats = {
                    ppg: getStat("avgPoints", "pointsPerGame", "ppg", "points"),
                    rpg: getStat("avgRebounds", "reboundsPerGame", "rpg", "rebounds"),
                    apg: getStat("avgAssists", "assistsPerGame", "apg", "assists"),
                    mpg: getStat("avgMinutes", "minutesPerGame", "mpg", "minutes"),
                    gp: getStat("gamesPlayed", "games", "appearances"),
                    spg: getStat("avgSteals", "stealsPerGame", "spg", "steals"),
                    bpg: getStat("avgBlocks", "blocksPerGame", "bpg", "blocks"),
                    fg: getStat("fieldGoalPct", "fgPct"),
                    three: getStat("threePointPct", "threePct", "3PtPct"),
                    ft: getStat("freeThrowPct", "ftPct"),
                  };

                  const statEntries = [
                    { label: "PPG", value: stats.ppg },
                    { label: "RPG", value: stats.rpg },
                    { label: "APG", value: stats.apg },
                    { label: "MPG", value: stats.mpg },
                    { label: "GP", value: stats.gp },
                    { label: "SPG", value: stats.spg },
                    { label: "BPG", value: stats.bpg },
                    { label: "FG%", value: stats.fg },
                    { label: "3P%", value: stats.three },
                    { label: "FT%", value: stats.ft },
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
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
                            {statEntries.map((s) => (
                              <div key={s.label} className="rounded-lg bg-muted/40 p-3 text-center">
                                <p className="text-sm text-muted-foreground">{s.label}</p>
                                <p className="text-xl font-bold text-foreground">{s.value}</p>
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
