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

// Use text-only pills for networks to avoid missing local assets.
export const NETWORK_LOGOS: Record<string, string | null> = {
  ESPN: "/networks/espn.svg",
  ESPN2: "/networks/espn.svg",
  "ESPN+": "/networks/espnplus.svg",
  FS1: "/networks/fs1.svg",
  FOX: "/networks/fox.svg",
  TNT: "/networks/tnt.svg",
  Peacock: "/networks/peacock.svg",
  ABC: "/networks/abc.svg",
  CBS: "/networks/cbs.svg",
  "CBS Sports": "/networks/cbssports.svg",
};

const getNetworks = (competition: any): string[] => {
  const broadcasts = competition?.broadcasts || competition?.broadcast || [];
  const names: string[] = [];
  broadcasts.forEach((b: any) => {
    const n =
      b?.media?.shortName ||
      b?.media?.name ||
      b?.shortName ||
      b?.name ||
      (Array.isArray(b?.names) ? b.names[0] : null);
    if (n) names.push(n);
  });
  return Array.from(new Set(names));
};

export function LiveWidget() {
  const currentSeasonYear = getCurrentSeasonYear();
  const bannedMatchups: string[] = [];
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

      // primary schedule (team 41)
      const [respPrimary, respAlt] = await Promise.all([
        fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/41/schedule?season=${seasonParam}`
        ),
        // broadcast-rich fallback (team 58 as noted)
        fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/58/schedule?season=${seasonParam}`
        ).catch(() => null),
      ]);

      const data = await respPrimary.json();
      let events = (data?.events || []).filter(
        (ev: any) => !bannedMatchups.includes(ev.shortName)
      );

      // Merge broadcasts from alt schedule if present
      if (respAlt && respAlt.ok) {
        const altData = await respAlt.json();
        const altEvents: any[] = altData?.events || [];
        const altMap = new Map<string, any>();
        altEvents.forEach((ev: any) => {
          if (ev?.id) altMap.set(ev.id, ev);
        });
        events = events.map((ev: any) => {
          const alt = altMap.get(ev.id);
          if (alt?.competitions?.[0]?.broadcasts?.length && !ev?.competitions?.[0]?.broadcasts?.length) {
            const clone = { ...ev };
            clone.competitions = [...(ev.competitions || [])];
            clone.competitions[0] = {
              ...(ev.competitions?.[0] || {}),
              broadcasts: alt.competitions?.[0]?.broadcasts || [],
            };
            return clone;
          }
          return ev;
        });
      }

      const now = new Date();
      const upcomingEvents = events
        .filter((event: any) => {
          const status = event.competitions?.[0]?.status?.type;
          if (event.season?.year !== seasonParam) return false;
          const isCompleted =
            status?.completed === true || status?.state === "post";
          const inProgress = status?.state === "in";
          return !isCompleted && !inProgress;
        })
        .sort(
          (a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

      if (upcomingEvents.length === 0 && events.length > 0) {
        const future = events
          .filter((ev: any) => {
            const d = new Date(ev.date);
            return d.getTime() >= now.getTime() - 24 * 60 * 60 * 1000;
          })
          .sort(
            (a: any, b: any) =>
              new Date(a.date).getTime() - new Date(b.date).getTime()
          );
        setUpcoming(future.length > 0 ? future.slice(0, 3) : events.slice(0, 1));
      } else {
        setUpcoming(upcomingEvents);
      }
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

  const uconnGames = (scoreboard?.events || [])
    .filter((event: any) =>
      event.competitions?.[0]?.competitors?.some(
        (team: any) => team.team.id === "41"
      )
    )
    .filter((event: any) => !bannedMatchups.includes(event.shortName));

  const todayStr = new Date().toDateString();
  const todayUpcoming = (upcoming || []).filter((event: any) => {
    const d = new Date(event.date);
    return d.toDateString() === todayStr;
  });

  const displayGames =
    (uconnGames && uconnGames.length > 0
      ? uconnGames
      : todayUpcoming.length > 0
      ? todayUpcoming
      : upcoming && upcoming.length > 0
      ? upcoming.slice(0, 1)
      : []) || [];

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
    if (status?.type?.completed) return "Final";
    const clock = status?.displayClock;
    const shortDetail = status?.type?.shortDetail || "";
    if (status?.type?.state === "in") {
      if (clock && shortDetail.includes(clock)) return shortDetail;
      if (shortDetail) return [clock, shortDetail].filter(Boolean).join(" - ");
      return clock || "In Progress";
    }
    return shortDetail || status?.type?.detail || status?.type?.description || "";
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
            const competition = game.competitions?.[0];
            if (!competition) return null;
            const homeTeam = competition.competitors?.find(
              (c: any) => c.homeAway === "home"
            );
            const awayTeam = competition.competitors?.find(
              (c: any) => c.homeAway === "away"
            );
            const isLive = game.status?.type?.state === "in";
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

            const awayLogo =
              awayTeam?.team?.logos?.[0]?.href || awayTeam?.team?.logo || null;
            const homeLogo =
              homeTeam?.team?.logos?.[0]?.href || homeTeam?.team?.logo || null;

            const matchupLabel = `${awayTeam?.team?.displayName || "Away"} vs ${
              homeTeam?.team?.displayName || "Home"
            }`;

            return (
              <Card key={game.id} className={isLive ? "border-primary" : ""}>
                <CardContent className="space-y-4 pt-4">
                  <div className="flex justify-end">
                    <Badge
                      variant={isLive ? "default" : "secondary"}
                      className="px-4 py-2 text-sm font-semibold"
                    >
                      {getGameStatus(game.status)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {awayLogo && (
                        <img
                          src={awayLogo}
                          alt={awayTeam.team.displayName}
                          className="h-12 w-12 rounded-[10px] object-contain"
                        />
                      )}
                      <div className="flex flex-col">
                        <span className="text-2xl font-bold">
                          {awayTeam?.team.abbreviation}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {awayTeam?.team.displayName}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-4xl font-bold ${
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
                      {homeLogo && (
                        <img
                          src={homeLogo}
                          alt={homeTeam.team.displayName}
                          className="h-12 w-12 rounded-[10px] object-contain"
                        />
                      )}
                      <div className="flex flex-col">
                        <span className="text-2xl font-bold">
                          {homeTeam?.team.abbreviation}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {homeTeam?.team.displayName}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-4xl font-bold ${
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
                    <div className="grid grid-cols-2 gap-3 text-base text-foreground mt-3">
                      <div className="space-y-1">
                        <p className="font-semibold">
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
                      <div className="text-right space-y-1">
                        <p className="font-semibold">
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
              const networks = getNetworks(competition);
            return (
                <Card
                  key={event.id}
                  className="bg-card border border-border/40 rounded-2xl shadow-sm"
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
                              isHome ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
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
                              isHome ? "bg-rose-500 text-white" : "bg-emerald-500 text-white"
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
                      <div className="mt-2 flex items-center flex-wrap gap-2">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                          Watch on
                        </span>
                        {networks.length > 0 ? (
                          networks.map((n) => (
                            <div key={n} className="inline-flex items-center">
                              {NETWORK_LOGOS[n] ? (
                                <img
                                  src={NETWORK_LOGOS[n] as string}
                                  alt={n}
                                  className="h-6 w-14 object-contain rounded-full bg-muted px-2 py-1"
                                />
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                                  {n}
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">TBD</span>
                        )}
                      </div>
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
