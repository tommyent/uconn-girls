import { getUConnTeamInfo } from "@/lib/espn-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar, TrendingUp } from "lucide-react";
import Image from "next/image";
import { HomeLiveWidget } from "@/components/home-live";

export const revalidate = 300; // Revalidate every 5 minutes

export default async function Home() {
  const teamData = await getUConnTeamInfo();
  const team = teamData?.team;
  const nextEvent =
    team?.nextEvent
      ?.filter((ev: any) => {
        const d = new Date(ev.date);
        const today = new Date();
        return d.getTime() >= today.getTime();
      })
      ?.sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      )?.[0] || null;
  const competition = nextEvent?.competitions?.[0];
  const homeTeam = competition?.competitors?.find(
    (c: any) => c.homeAway === "home"
  );
  const awayTeam = competition?.competitors?.find(
    (c: any) => c.homeAway === "away"
  );

  return (
    <main className="min-h-screen p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8 mt-8">
        {team?.logos?.[0]?.href && (
          <Image
            src={team.logos[0].href}
            alt="UConn Logo"
            width={120}
            height={120}
            className="mx-auto mb-4 rounded-[10px]"
          />
        )}
        <h1 className="text-5xl md:text-6xl font-bold text-primary mb-2">
          {team?.displayName || "UConn Huskies"}
        </h1>
        <p className="text-xl text-muted-foreground">
          Women's Basketball
        </p>
      </div>

      {/* Current Record */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              Record & Ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <p className="text-sm text-muted-foreground">Record</p>
                <p className="text-4xl font-bold leading-tight">
                  {team?.record?.items?.find((r: any) => r.type === "total")?.summary || "0-0"}
                </p>
                <p className="text-muted-foreground mt-1">
                  {team?.standingSummary || "Season 2025-26"}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-sm text-muted-foreground">Ranking</p>
                <p className="text-4xl font-bold leading-tight">
                  #{team?.rank || "1"}
                </p>
                <p className="text-muted-foreground mt-1">AP Poll</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              Next Game
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextEvent ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {awayTeam?.team?.logos?.[0]?.href && (
                      <Image
                        src={awayTeam.team.logos[0].href}
                        alt={awayTeam.team.displayName}
                        width={48}
                        height={48}
                        className="rounded-lg object-contain"
                      />
                    )}
                    <div className="space-y-1">
                      <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-rose-500 text-white">
                        Away
                      </div>
                      <p className="font-semibold text-foreground">
                        {awayTeam?.team?.displayName || "TBD"}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-muted-foreground">at</div>
                  <div className="flex items-center gap-2">
                    {homeTeam?.team?.logos?.[0]?.href && (
                      <Image
                        src={homeTeam.team.logos[0].href}
                        alt={homeTeam.team.displayName}
                        width={48}
                        height={48}
                        className="rounded-lg object-contain"
                      />
                    )}
                    <div className="space-y-1">
                      <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-emerald-500 text-white">
                        Home
                      </div>
                      <p className="font-semibold text-foreground">
                        {homeTeam?.team?.displayName || "TBD"}
                      </p>
                    </div>
                  </div>
                </div>
                {awayTeam?.team && homeTeam?.team ? (
                  <p className="sr-only">
                    {awayTeam.team.displayName} @ {homeTeam.team.displayName}
                  </p>
                ) : (
                  <p className="sr-only">{nextEvent.shortName}</p>
                )}
                <p className="text-muted-foreground">
                  {new Date(nextEvent.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">No upcoming games</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live + Upcoming */}
      <div className="mt-12 space-y-4">
        <h2 className="text-3xl font-bold">Live & Upcoming</h2>
        <HomeLiveWidget />
      </div>

    </main>
  );
}
