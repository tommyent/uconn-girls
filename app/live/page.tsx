"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGameSummary } from "@/lib/espn-api";

const getCurrentSeasonYear = () => {
  const today = new Date();
  // Season spans fall-spring; before July we are still in the prior season
  return today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
};

export default function LivePage() {
  const currentSeasonYear = getCurrentSeasonYear();
  const [scoreboard, setScoreboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [summaries, setSummaries] = useState<Record<string, any>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fetchScores = async () => {
    try {
      const response = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard"
      );
      const data = await response.json();
      setScoreboard(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching scores:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedule = async () => {
    setUpcomingLoading(true);
    try {
      const seasonParam = currentSeasonYear + 1; // ESPN uses season end year
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/41/schedule?season=${seasonParam}`
      );
      const data = await response.json();
      const events = data?.events || [];
      const now = new Date();
      const upcomingEvents = events
        .filter((event: any) => {
          const status = event.competitions?.[0]?.status?.type;
          const eventDate = new Date(event.date);
          if (event.season?.year !== seasonParam) return false;
          // Keep anything not completed and today/future
          const notCompleted = !status?.completed;
          return notCompleted && eventDate >= new Date(now.toDateString());
        })
        .sort(
          (a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      setUpcoming(upcomingEvents);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      setUpcoming([]);
    } finally {
      setUpcomingLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
    fetchSchedule();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchScores, 30000);
    return () => clearInterval(interval);
  }, []);

  const uconnGames = scoreboard?.events?.filter((event: any) => {
    return (
      event.competitions[0].competitors.some(
        (team: any) => team.team.id === "41"
      )
    );
  });

  useEffect(() => {
    const fetchSummaries = async () => {
      if (!uconnGames || uconnGames.length === 0) return;
      const idsToFetch = uconnGames
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
    fetchSummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uconnGames]);

  const getGameStatus = (status: any) => {
    if (status.type.completed) return "Final";
    if (status.type.state === "in") {
      return `${status.displayClock} - ${status.type.shortDetail}`;
    }
    return status.type.shortDetail;
  };

  const getTeamStats = (eventId: string, teamId: string) => {
    const summary = summaries[eventId];
    const boxTeams = summary?.boxscore?.teams;
    if (!boxTeams) return null;
    const teamBox = boxTeams.find((t: any) => t.team?.id === teamId);
    if (!teamBox) return null;
    const stats = teamBox.statistics || [];
    const lookup = (names: string[]) => {
      const found = stats.find((s: any) => names.includes(s.name));
      return found?.displayValue ?? found?.value ?? null;
    };
    return {
      fg: lookup(["fieldGoalPct", "fgPct"]),
      three: lookup(["threePointFieldGoalPct", "threePointPct", "3PtPct"]),
      ft: lookup(["freeThrowPct", "ftPct"]),
      reb: lookup(["totalRebounds"]),
      ast: lookup(["assists"]),
      to: lookup(["turnovers", "totalTurnovers"]),
    };
  };

  return (
    <main className="min-h-screen p-6 max-w-screen-xl mx-auto">
      <div className="flex justify-between items-center mb-8 mt-8">
        <h1 className="text-5xl font-bold text-primary">Live Scores</h1>
        <Button
          onClick={fetchScores}
          size="lg"
          variant="outline"
          disabled={loading}
        >
          <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2 text-muted-foreground mb-6">
        <Clock className="h-5 w-5" />
        <span className="text-lg">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </span>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <RefreshCw className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="text-xl text-muted-foreground">Loading scores...</p>
          </CardContent>
        </Card>
      ) : uconnGames && uconnGames.length > 0 ? (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold">UConn Games</h2>
          {uconnGames.map((game: any) => {
            const competition = game.competitions[0];
            const homeTeam = competition.competitors.find(
              (c: any) => c.homeAway === "home"
            );
            const awayTeam = competition.competitors.find(
              (c: any) => c.homeAway === "away"
            );
            const isLive = game.status.type.state === "in";
            const uTeamId = "41";
            const oppTeamId =
              homeTeam?.team?.id === uTeamId
                ? awayTeam?.team?.id
                : homeTeam?.team?.id;
            const uStats = getTeamStats(game.id, uTeamId);
            const oppStats = oppTeamId ? getTeamStats(game.id, oppTeamId) : null;

            return (
              <Card key={game.id} className={isLive ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>{game.name}</CardTitle>
                    <Badge variant={isLive ? "default" : "secondary"}>
                      {getGameStatus(game.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Away Team */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold">
                          {awayTeam?.team.abbreviation}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {awayTeam?.team.displayName}
                        </span>
                      </div>
                      <span className="text-4xl font-bold">
                        {awayTeam?.score || "0"}
                      </span>
                    </div>

                    {/* Home Team */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold">
                          {homeTeam?.team.abbreviation}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {homeTeam?.team.displayName}
                        </span>
                      </div>
                      <span className="text-4xl font-bold">
                        {homeTeam?.score || "0"}
                      </span>
                    </div>

                    {competition.venue && (
                      <p className="text-sm text-muted-foreground mt-4">
                        {competition.venue.fullName}
                      </p>
                    )}
                    {uStats && oppStats && (
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="font-semibold text-foreground">
                            {homeTeam?.team?.abbreviation}
                          </p>
                          <p className="text-muted-foreground">FG%: {homeTeam?.team?.id === uTeamId ? uStats.fg ?? "—" : oppStats.fg ?? "—"}</p>
                          <p className="text-muted-foreground">3P%: {homeTeam?.team?.id === uTeamId ? uStats.three ?? "—" : oppStats.three ?? "—"}</p>
                          <p className="text-muted-foreground">FT%: {homeTeam?.team?.id === uTeamId ? uStats.ft ?? "—" : oppStats.ft ?? "—"}</p>
                          <p className="text-muted-foreground">REB: {homeTeam?.team?.id === uTeamId ? uStats.reb ?? "—" : oppStats.reb ?? "—"}</p>
                          <p className="text-muted-foreground">AST: {homeTeam?.team?.id === uTeamId ? uStats.ast ?? "—" : oppStats.ast ?? "—"}</p>
                          <p className="text-muted-foreground">TO: {homeTeam?.team?.id === uTeamId ? uStats.to ?? "—" : oppStats.to ?? "—"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-foreground">
                            {awayTeam?.team?.abbreviation}
                          </p>
                          <p className="text-muted-foreground">FG%: {awayTeam?.team?.id === uTeamId ? uStats.fg ?? "—" : oppStats.fg ?? "—"}</p>
                          <p className="text-muted-foreground">3P%: {awayTeam?.team?.id === uTeamId ? uStats.three ?? "—" : oppStats.three ?? "—"}</p>
                          <p className="text-muted-foreground">FT%: {awayTeam?.team?.id === uTeamId ? uStats.ft ?? "—" : oppStats.ft ?? "—"}</p>
                          <p className="text-muted-foreground">REB: {awayTeam?.team?.id === uTeamId ? uStats.reb ?? "—" : oppStats.reb ?? "—"}</p>
                          <p className="text-muted-foreground">AST: {awayTeam?.team?.id === uTeamId ? uStats.ast ?? "—" : oppStats.ast ?? "—"}</p>
                          <p className="text-muted-foreground">TO: {awayTeam?.team?.id === uTeamId ? uStats.to ?? "—" : oppStats.to ?? "—"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-2xl text-muted-foreground">
              No UConn games today
            </p>
            <p className="text-lg text-muted-foreground mt-2">
              Check back during game days for live updates
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Schedule */}
      <div className="mt-12">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-6 w-6 text-primary" />
          <h2 className="text-3xl font-bold">Upcoming Games</h2>
        </div>
        {upcomingLoading ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Loading schedule...
            </CardContent>
          </Card>
        ) : upcoming.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No upcoming games on the schedule
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcoming.map((event: any) => {
              const competition = event.competitions?.[0];
              const uconnTeam = competition?.competitors?.find(
                (c: any) => c.team?.id === "41"
              );
              const opponent = competition?.competitors?.find(
                (c: any) => c.team?.id !== "41"
              );
              if (!competition || !uconnTeam || !opponent) return null;

              const isHome = uconnTeam.homeAway === "home";
              const venue = competition.venue?.fullName;

              return (
                <Card key={event.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {new Date(event.date).toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-xl font-bold">
                          vs {opponent.team?.displayName}
                        </p>
                        {venue && (
                          <p className="text-sm text-muted-foreground">
                            {venue}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">
                        {isHome ? "HOME" : "AWAY"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

    </main>
  );
}
