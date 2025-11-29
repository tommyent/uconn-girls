import { getUConnTeamInfo } from "@/lib/espn-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar, TrendingUp } from "lucide-react";
import Image from "next/image";

export const revalidate = 300; // Revalidate every 5 minutes

export default async function Home() {
  const teamData = await getUConnTeamInfo();
  const team = teamData?.team;
  const nextEvent = team?.nextEvent?.[0];

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
            className="mx-auto mb-4"
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              Record
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">
              {team?.record?.items?.find((r: any) => r.type === "total")?.summary || "0-0"}
            </p>
            <p className="text-muted-foreground mt-2">
              {team?.standingSummary || "Season 2025-26"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">
              #{team?.rank || "1"}
            </p>
            <p className="text-muted-foreground mt-2">
              AP Poll
            </p>
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
              <>
                <p className="text-xl font-bold">
                  {nextEvent.shortName}
                </p>
                <p className="text-muted-foreground mt-2">
                  {new Date(nextEvent.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No upcoming games</p>
            )}
          </CardContent>
        </Card>
      </div>

    </main>
  );
}
