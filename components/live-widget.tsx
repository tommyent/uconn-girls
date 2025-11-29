"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Calendar, Clock } from "lucide-react";
import { getGameSummary } from "@/lib/espn-api";

const getCurrentSeasonYear = () => {
  const today = new Date();
  return today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
};

export function LiveWidget() {
  const currentSeasonYear = getCurrentSeasonYear();
  const bannedMatchups = ["CONN @ XAV"];
  const [scoreboard, setScoreboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [summaries, setSummaries] = useState<Record<string, any>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

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
      const seasonParam = currentSeasonYear + 1;
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/41/schedule?season=${seasonParam}`
      );
      const data = await response.json();
      const events = (data?.events || []).filter(
        (ev: any) => !bannedMatchups.includes(ev.shortName)
      );
      const now = new Date();
      const upcomingEvents = events
        .filter((event: any) => {
          const status = event.competitions?.[0]?.status?.type;
          const eventDate = new Date(event.date);
          if (event.season?.year !== seasonParam) return false;
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
    const interval = setInterval(fetchScores, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const uconnGames = scoreboard?.events
    ?.filter((event: any) =>
      event.competitions?.[0]?.competitors?.some(
        (team: any) => team.team.id === "41"
      )
    )
    ?.filter((event: any) => !bannedMatchups.includes(event.shortName));
  const displayGames = uconnGames || [];

  useEffect(() => {
    const fetchSummaries = async () => {
      if (!displayGames || displayGames.length === 0) return;
      const idsToFetch = displayGames
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
          if (res?.id && res.data) next[res.id] = res.data;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Live</h2>
        <Button
          onClick={fetchScores}
          size="sm"
          variant="outline"
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span className="text-sm">
          Last updated:{" "}
          {mounted
            ? lastUpdate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              })
            : "—"}
        </span>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Loading scores...</p>
          </CardContent>
        </Card>
      ) : displayGames && displayGames.length > 0 ? (
        <div className="space-y-4">
          {displayGames.map((game: any) => {
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
            const homeScore = Number(homeTeam?.score) || 0;
            const awayScore = Number(awayTeam?.score) || 0;
            const isHomeHigher = homeScore > awayScore;
            const isAwayHigher = awayScore > homeScore;

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
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {awayTeam?.team?.logos?.[0]?.href && (
                        <img
                          src={awayTeam.team.logos[0].href}
                          alt={awayTeam.team.displayName}
                          className="h-10 w-10 rounded-[10px] object-contain"
                        />
                      )}
                      <div className="flex flex-col">
                        <span className="text-xl font-bold">
                          {awayTeam?.team.abbreviation}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {awayTeam?.team.displayName}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-3xl font-bold ${
                        isAwayHigher
                          ? "text-emerald-400"
                          : isHomeHigher
                          ? "text-rose-400"
                          : "text-foreground"
                      }`}
                    >
                      {awayTeam?.score || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {homeTeam?.team?.logos?.[0]?.href && (
                        <img
                          src={homeTeam.team.logos[0].href}
                          alt={homeTeam.team.displayName}
                          className="h-10 w-10 rounded-[10px] object-contain"
                        />
                      )}
                      <div className="flex flex-col">
                        <span className="text-xl font-bold">
                          {homeTeam?.team.abbreviation}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {homeTeam?.team.displayName}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-3xl font-bold ${
                        isHomeHigher
                          ? "text-emerald-400"
                          : isAwayHigher
                          ? "text-rose-400"
                          : "text-foreground"
                      }`}
                    >
                      {homeTeam?.score || "0"}
                    </span>
                  </div>

                  {uStats && oppStats && (
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-3">
                      <div>
                        <p className="font-semibold text-foreground">
                          {homeTeam?.team?.abbreviation === "CONN"
                            ? "UConn"
                            : homeTeam?.team?.abbreviation}
                        </p>
                        <p>FG%: {homeTeam?.team?.id === uTeamId ? uStats.fg ?? "—" : oppStats.fg ?? "—"}</p>
                        <p>3P%: {homeTeam?.team?.id === uTeamId ? uStats.three ?? "—" : oppStats.three ?? "—"}</p>
                        <p>FT%: {homeTeam?.team?.id === uTeamId ? uStats.ft ?? "—" : oppStats.ft ?? "—"}</p>
                        <p>REB: {homeTeam?.team?.id === uTeamId ? uStats.reb ?? "—" : oppStats.reb ?? "—"}</p>
                        <p>AST: {homeTeam?.team?.id === uTeamId ? uStats.ast ?? "—" : oppStats.ast ?? "—"}</p>
                        <p>TO: {homeTeam?.team?.id === uTeamId ? uStats.to ?? "—" : oppStats.to ?? "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">
                          {awayTeam?.team?.abbreviation === "CONN"
                            ? "UConn"
                            : awayTeam?.team?.abbreviation}
                        </p>
                        <p>FG%: {awayTeam?.team?.id === uTeamId ? uStats.fg ?? "—" : oppStats.fg ?? "—"}</p>
                        <p>3P%: {awayTeam?.team?.id === uTeamId ? uStats.three ?? "—" : oppStats.three ?? "—"}</p>
                        <p>FT%: {awayTeam?.team?.id === uTeamId ? uStats.ft ?? "—" : oppStats.ft ?? "—"}</p>
                        <p>REB: {awayTeam?.team?.id === uTeamId ? uStats.reb ?? "—" : oppStats.reb ?? "—"}</p>
                        <p>AST: {awayTeam?.team?.id === uTeamId ? uStats.ast ?? "—" : oppStats.ast ?? "—"}</p>
                        <p>TO: {awayTeam?.team?.id === uTeamId ? uStats.to ?? "—" : oppStats.to ?? "—"}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No UConn games today</p>
          </CardContent>
        </Card>
      )}

      {/* Upcoming */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Upcoming Games</h3>
        </div>
        {upcomingLoading ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Loading schedule...
            </CardContent>
          </Card>
        ) : upcoming.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No upcoming games on the schedule
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcoming.map((event: any) => {
              const competition = event.competitions?.[0];
              const uconnTeam = competition?.competitors?.find(
                (c: any) => c.team.id === "41"
              );
              const opponent = competition?.competitors?.find(
                (c: any) => c.team.id !== "41"
              );
              if (!competition || !uconnTeam || !opponent) return null;
              const isHome = uconnTeam.homeAway === "home";
              const venue = competition.venue?.fullName;
              return (
                <Card
                  key={event.id}
                  className="bg-gradient-to-r from-primary/15 to-primary/5 border border-border/40 rounded-2xl shadow-sm"
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex items-center gap-3">
                        {uconnTeam?.team?.logos?.[0]?.href && (
                          <img
                            src={uconnTeam.team.logos[0].href}
                            alt="UConn"
                            className="h-14 w-14 rounded-[10px] object-contain"
                          />
                        )}
                        <div className="space-y-2">
                          <div
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              isHome
                                ? "bg-emerald-500/20 text-emerald-100"
                                : "bg-rose-500/20 text-rose-100"
                            }`}
                          >
                            {isHome ? "HOME" : "AWAY"}
                          </div>
                          <p className="text-2xl font-bold text-foreground leading-tight">
                            UConn Huskies
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div className="space-y-2">
                          <div
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              isHome
                                ? "bg-rose-500/20 text-rose-100"
                                : "bg-emerald-500/20 text-emerald-100"
                            }`}
                          >
                            {isHome ? "AWAY" : "HOME"}
                          </div>
                          <p className="text-2xl font-bold text-foreground leading-tight">
                            {opponent.team.displayName}
                          </p>
                        </div>
                        {opponent?.team?.logos?.[0]?.href && (
                          <img
                            src={opponent.team.logos[0].href}
                            alt={opponent.team.displayName}
                            className="h-14 w-14 rounded-[10px] object-contain"
                          />
                        )}
                      </div>
                    </div>
                    <div className="text-base text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {new Date(event.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      {venue && <p>{venue}</p>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
