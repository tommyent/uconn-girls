"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { getGameSummary } from "@/lib/espn-api";
import { NETWORK_LOGOS } from "@/components/live-widget";

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

const readCache = <T,>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.exp && parsed.exp < Date.now()) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed?.data as T;
  } catch {
    return null;
  }
};

const writeCache = (key: string, data: any) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ exp: Date.now() + CACHE_TTL_MS, data })
    );
  } catch {
    // ignore quota/availability errors
  }
};

  const getCurrentSeasonYear = () => {
  const today = new Date();
  // NCAA season spans fall-spring; before July we are still in the prior season
  return today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
};

const StatRow = ({
  label,
  home,
  away,
  homePercent,
  awayPercent,
}: {
  label: string;
  home: string | number | null;
  away: string | number | null;
  homePercent?: number | null;
  awayPercent?: number | null;
}) => (
  <div className="space-y-1">
    <div className="grid grid-cols-3 text-sm text-muted-foreground">
      <span className="text-left">{home ?? "—"}</span>
      <span className="text-center text-foreground font-medium">{label}</span>
      <span className="text-right">{away ?? "—"}</span>
    </div>
    {(homePercent !== null || awayPercent !== null) && (
      <div className="grid grid-cols-3 items-center gap-2 text-[11px] text-muted-foreground">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary/80"
            style={{ width: `${Math.min(Math.max(homePercent ?? 0, 0), 100)}%` }}
          />
        </div>
        <div />
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary/60"
            style={{ width: `${Math.min(Math.max(awayPercent ?? 0, 0), 100)}%` }}
          />
        </div>
      </div>
    )}
  </div>
);

export default function HistoryPage() {
  const currentSeasonYear = getCurrentSeasonYear();
  const [selectedYear, setSelectedYear] = useState(currentSeasonYear);
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<Record<string, any>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [scoreboardPlayers, setScoreboardPlayers] = useState<Record<string, any>>(
    {}
  );
  const [scoreboardLoading, setScoreboardLoading] = useState(false);
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});
  const [coverageNetworks, setCoverageNetworks] = useState<Record<string, string[]>>({});

  const years = Array.from({ length: 5 }, (_, i) => currentSeasonYear - i);

  const fetchSchedule = async (year: number) => {
    const cacheKey = `schedule-${year}`;
    const cached = readCache<any>(cacheKey);
    if (cached) {
      setSchedule(cached);
      setLoading(false);
    } else {
      setLoading(true);
      setSchedule(null);
    }
    try {
      const seasonParam = year + 1; // ESPN season param is the end year
      const [respPrimary, respAlt] = await Promise.all([
        fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/41/schedule?season=${seasonParam}`
        ),
        fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams/58/schedule?season=${seasonParam}`
        ).catch(() => null),
      ]);

      if (!respPrimary.ok) {
        setSchedule({ events: [] });
        return;
      }

      const data = await respPrimary.json();
      let safeData = data ?? { events: [] };

      // Merge broadcasts from alt schedule (team 58) if primary missing them
      if (respAlt && respAlt.ok) {
        const altData = await respAlt.json();
        const altEvents: any[] = altData?.events || [];
        const altMap = new Map<string, any>();
        altEvents.forEach((ev: any) => {
          if (ev?.id) altMap.set(ev.id, ev);
        });
        const mergedEvents = (safeData.events || []).map((ev: any) => {
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
        safeData = { ...safeData, events: mergedEvents };
      }

      setSchedule(safeData);
      writeCache(cacheKey, safeData);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      setSchedule({ events: [] });
    } finally {
      setLoading(false);
    }
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

  const fetchCoverageNetworks = async (
    eventId: string,
    eventDate: string,
    opponentName: string
  ) => {
    try {
      const date = new Date(eventDate);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const coverageUrl = `https://uconnhuskies.com/coverage?page=1&date=${yyyy}-${mm}-${dd}`;
      const res = await fetch(coverageUrl);
      if (!res.ok) return;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const rows = Array.from(doc.querySelectorAll("tr"));
      const nets: string[] = [];
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 4) return;
        const sport = cells[1]?.textContent?.toLowerCase() || "";
        if (!sport.includes("women")) return;
        const opponent = cells[2]?.textContent?.trim().toLowerCase() || "";
        if (
          opponentName &&
          opponent &&
          !opponentName.toLowerCase().includes(opponent) &&
          !opponent.includes(opponentName.toLowerCase())
        )
          return;
        const tv = cells[3]?.textContent?.trim() || "";
        if (tv) {
          tv
            .split(/[\/,&]/)
            .map((t) => t.trim())
            .filter(Boolean)
            .forEach((t) => nets.push(t));
        }
      });
      if (nets.length > 0) {
        setCoverageNetworks((prev) => ({ ...prev, [eventId]: Array.from(new Set(nets)) }));
      }
    } catch {
      // ignore failures
    }
  };

  useEffect(() => {
    fetchSchedule(selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    const cachedSummaries = readCache<Record<string, any>>(
      `summaries-${selectedYear}`
    );
    if (cachedSummaries) setSummaries(cachedSummaries);
    const cachedPlayers = readCache<Record<string, any>>(
      `scoreboardPlayers-${selectedYear}`
    );
    if (cachedPlayers) setScoreboardPlayers(cachedPlayers);
  }, [selectedYear]);

  useEffect(() => {
    const prefetchCoverage = async () => {
      if (!schedule?.events) return;
      const upcomingOnly = schedule.events.filter(
        (event: any) => !event.competitions?.[0]?.status?.type?.completed
      );
      for (const event of upcomingOnly) {
        const competition = event?.competitions?.[0];
        if (!competition) continue;
        const nets = getNetworks(competition);
        if (nets && nets.length > 0) continue;
        const opponent = competition.competitors?.find(
          (c: any) => c.team?.id !== "41"
        );
        const opponentName = opponent?.team?.displayName || "";
        await fetchCoverageNetworks(event.id, event.date, opponentName);
      }
    };
    prefetchCoverage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

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
        writeCache(`summaries-${selectedYear}`, next);
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
        writeCache(`scoreboardPlayers-${selectedYear}`, next);
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
        headshot:
          ath?.athlete?.headshot?.href ||
          ath?.headshot?.href ||
          ath?.athlete?.photo?.href ||
          null,
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
        headshot:
          ath?.athlete?.headshot?.href ||
          ath?.headshot?.href ||
          ath?.athlete?.photo?.href ||
          null,
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
  const winRateRaw = decidedTotal > 0 ? (wins / decidedTotal) * 100 : 0;
  const lossRateRaw = decidedTotal > 0 ? 100 - winRateRaw : 0;
  const formatRate = (val: number) =>
    Number.isFinite(val) ? Number(val.toFixed(1)).toString().replace(/\.0$/, "") : "0";

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
        <Card className="mb-8 bg-card/80 border border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Season Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 items-center gap-6">
              <div className="text-center space-y-1">
                <p className="text-5xl font-bold text-green-500">{wins}</p>
                <p className="text-base font-semibold text-green-500">Wins</p>
                <p className="text-sm text-muted-foreground">
                  {formatRate(winRateRaw)}% Win Rate
                </p>
              </div>
              <div className="text-center space-y-1">
                <p className="text-5xl font-bold text-red-500">{losses}</p>
                <p className="text-base font-semibold text-red-500">Losses</p>
                <p className="text-sm text-muted-foreground">
                  {formatRate(lossRateRaw)}% Loss Rate
                </p>
              </div>
            </div>
            <div className="mt-6 h-3 w-full rounded-full bg-muted overflow-hidden">
              <div className="flex h-full w-full">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${(wins / decidedTotal) * 100}%` }}
                />
                <div
                  className="h-full bg-red-500 flex-1"
                  style={{ width: `${(losses / decidedTotal) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
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
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">Completed Games</h2>
              {[...completedGames].reverse().map((event: any) => {
                const result = getGameResult(event);
                if (!result) return null;

                const competition = event.competitions?.[0];
                const homeTeam = competition?.competitors?.find(
                  (c: any) => c.homeAway === "home"
                );
                const awayTeam = competition?.competitors?.find(
                  (c: any) => c.homeAway === "away"
                );

                const teamStatsLookup = (teamId: string) => {
                  const stats =
                    result.boxTeams?.find((t: any) => t.team?.id === teamId)
                      ?.statistics || [];
                  const find = (...keys: string[]) => {
                    const stat = stats.find((s: any) => keys.includes(s.name));
                    return stat?.displayValue ?? stat?.value ?? "—";
                  };
                  const num = (val: any) => {
                    if (val === null || val === undefined) return null;
                    if (typeof val === "number") return val;
                    const stripped = String(val).replace(/[^\d.-]/g, "");
                    const parsed = parseFloat(stripped);
                    return Number.isFinite(parsed) ? parsed : null;
                  };
                  return {
                    fg: find("fieldGoalPct", "fgPct"),
                    fgNum: num(find("fieldGoalPct", "fgPct")),
                    three: find(
                      "threePointFieldGoalPct",
                      "threePointPct",
                      "3PtPct"
                    ),
                    threeNum: num(
                      find("threePointFieldGoalPct", "threePointPct", "3PtPct")
                    ),
                    ft: find("freeThrowPct", "ftPct"),
                    ftNum: num(find("freeThrowPct", "ftPct")),
                    reb: find("totalRebounds"),
                    rebNum: num(find("totalRebounds")),
                    ast: find("assists"),
                    astNum: num(find("assists")),
                    to: find("turnovers", "totalTurnovers"),
                    toNum: num(find("turnovers", "totalTurnovers")),
                  };
                };

                const homeStats = homeTeam?.team?.id
                  ? teamStatsLookup(homeTeam.team.id)
                  : null;
                const awayStats = awayTeam?.team?.id
                  ? teamStatsLookup(awayTeam.team.id)
                  : null;

                const homePlayers = homeTeam?.team?.id
                  ? getPlayerLines(event.id, homeTeam.team.id)
                  : [];
                const awayPlayers = awayTeam?.team?.id
                  ? getPlayerLines(event.id, awayTeam.team.id)
                  : [];
                const uconnCompetitor = competition?.competitors?.find(
                  (c: any) => c.team?.id === "41"
                );
                const leftScore =
                  awayTeam?.team?.id === uconnCompetitor?.team?.id
                    ? result.uconnScore
                    : result.opponentScore;
                const rightScore =
                  homeTeam?.team?.id === uconnCompetitor?.team?.id
                    ? result.uconnScore
                    : result.opponentScore;
                const resultColor =
                  result.outcome === "win"
                    ? "hsl(80deg 100% 55%)"
                    : result.outcome === "loss"
                    ? "hsl(345.37deg 100% 66.42%)"
                    : "var(--muted)";

                return (
                  <div key={event.id} className="space-y-3">
                    <div className="bg-gradient-to-r from-primary/80 to-primary/40 px-4 py-6 text-white rounded-2xl shadow-lg">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {awayTeam?.team?.logos?.[0]?.href && (
                            <img
                              src={awayTeam.team.logos[0].href}
                              alt={awayTeam.team.displayName}
                              className="h-10 w-10 object-contain rounded-[10px]"
                            />
                          )}
                          <div className="space-y-1">
                            <p className="text-xs tracking-wide font-semibold uppercase">
                              {awayTeam?.team?.shortDisplayName || "AWAY"}
                            </p>
                            <Badge
                              variant="secondary"
                              className="text-xs px-3 py-1 bg-rose-500 text-white border-0"
                            >
                              AWAY
                            </Badge>
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-3xl md:text-4xl font-bold text-white">
                            {leftScore ?? "—"} - {rightScore ?? "—"}
                          </p>
                          <p className="text-sm font-semibold uppercase mt-1">
                            {competition?.status?.type?.shortDetail || "Final"}
                          </p>
                          <p className="text-xs">
                            {new Date(event.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right space-y-1">
                            <p className="text-xs tracking-wide font-semibold uppercase">
                              {homeTeam?.team?.shortDisplayName || "HOME"}
                            </p>
                            <Badge
                              variant="secondary"
                              className="text-xs px-3 py-1 bg-emerald-500 text-white border-0"
                            >
                              HOME
                            </Badge>
                          </div>
                          {homeTeam?.team?.logos?.[0]?.href && (
                            <img
                              src={homeTeam.team.logos[0].href}
                              alt={homeTeam.team.displayName}
                              className="h-10 w-10 object-contain rounded-[10px]"
                            />
                          )}
                        </div>
                      </div>
                      <div className="mt-4 h-0.5 w-full rounded-full bg-muted overflow-hidden relative">
                        <div
                          className="absolute inset-0 blur-[2px]"
                          style={{ backgroundColor: resultColor }}
                        />
                        <div
                          className="relative h-full w-full"
                          style={{ backgroundColor: resultColor }}
                        />
                      </div>
                    </div>

                    <Card className="bg-transparent border-0 shadow-none overflow-visible">
                      <CardContent className="p-0 space-y-3">
                        {(homeStats || awayStats) && (
                          <div className="bg-card text-card-foreground flex flex-col gap-4 rounded-xl border border-border/30 p-4 shadow-sm">
                            <p className="text-sm font-semibold text-foreground mb-1">
                              Team Comparison
                            </p>
                            <StatRow
                              label="FG%"
                            home={homeStats?.fg ?? "—"}
                            away={awayStats?.fg ?? "—"}
                            homePercent={homeStats?.fgNum ?? null}
                            awayPercent={awayStats?.fgNum ?? null}
                          />
                          <StatRow
                            label="3P%"
                            home={homeStats?.three ?? "—"}
                            away={awayStats?.three ?? "—"}
                            homePercent={homeStats?.threeNum ?? null}
                            awayPercent={awayStats?.threeNum ?? null}
                          />
                          <StatRow
                            label="FT%"
                            home={homeStats?.ft ?? "—"}
                            away={awayStats?.ft ?? "—"}
                            homePercent={homeStats?.ftNum ?? null}
                            awayPercent={awayStats?.ftNum ?? null}
                          />
                          <StatRow
                            label="REB"
                            home={homeStats?.reb ?? "—"}
                            away={awayStats?.reb ?? "—"}
                            homePercent={
                              homeStats &&
                              awayStats &&
                              homeStats.rebNum !== null &&
                              awayStats.rebNum !== null
                                ? (homeStats.rebNum / (homeStats.rebNum + awayStats.rebNum)) * 100
                                : null
                            }
                            awayPercent={
                              homeStats &&
                              awayStats &&
                              homeStats.rebNum !== null &&
                              awayStats.rebNum !== null
                                ? (awayStats.rebNum / (homeStats.rebNum + awayStats.rebNum)) * 100
                                : null
                            }
                          />
                          <StatRow
                            label="AST"
                            home={homeStats?.ast ?? "—"}
                            away={awayStats?.ast ?? "—"}
                            homePercent={
                              homeStats &&
                              awayStats &&
                              homeStats.astNum !== null &&
                              awayStats.astNum !== null
                                ? (homeStats.astNum / (homeStats.astNum + awayStats.astNum)) * 100
                                : null
                            }
                            awayPercent={
                              homeStats &&
                              awayStats &&
                              homeStats.astNum !== null &&
                              awayStats.astNum !== null
                                ? (awayStats.astNum / (homeStats.astNum + awayStats.astNum)) * 100
                                : null
                            }
                          />
                          <StatRow
                            label="TO"
                            home={homeStats?.to ?? "—"}
                            away={awayStats?.to ?? "—"}
                            homePercent={
                              homeStats &&
                              awayStats &&
                              homeStats.toNum !== null &&
                              awayStats.toNum !== null
                                ? (homeStats.toNum / (homeStats.toNum + awayStats.toNum)) * 100
                                : null
                            }
                            awayPercent={
                              homeStats &&
                              awayStats &&
                              homeStats.toNum !== null &&
                              awayStats.toNum !== null
                                ? (awayStats.toNum / (homeStats.toNum + awayStats.toNum)) * 100
                                : null
                            }
                          />
                        </div>
                      )}

                      {(homePlayers.length > 0 || awayPlayers.length > 0) && (
                        <div className="space-y-3">
                          <div className="flex items-center text-sm font-semibold">
                            <button
                              className={`flex-1 text-center pb-2 border-b-2 ${
                                (activeTabs[event.id] || homeTeam?.team?.id) ===
                                homeTeam?.team?.id
                                  ? "border-primary text-foreground"
                                  : "border-transparent text-muted-foreground"
                              }`}
                              onClick={() =>
                                setActiveTabs((prev) => ({
                                  ...prev,
                                  [event.id]: homeTeam?.team?.id,
                                }))
                              }
                            >
                              {homeTeam?.team?.shortDisplayName || "Home"}
                            </button>
                            <button
                              className={`flex-1 text-center pb-2 border-b-2 ${
                                (activeTabs[event.id] || homeTeam?.team?.id) ===
                                awayTeam?.team?.id
                                  ? "border-primary text-foreground"
                                  : "border-transparent text-muted-foreground"
                              }`}
                              onClick={() =>
                                setActiveTabs((prev) => ({
                                  ...prev,
                                  [event.id]: awayTeam?.team?.id,
                                }))
                              }
                            >
                              {awayTeam?.team?.shortDisplayName || "Away"}
                            </button>
                          </div>
                          <div className="bg-card text-card-foreground rounded-xl border border-border/30 p-4 shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {(activeTabs[event.id] || homeTeam?.team?.id) ===
                              homeTeam?.team?.id
                                ? homePlayers
                                    .filter(
                                      (p: any) =>
                                        p.mins !== null &&
                                        p.mins !== undefined &&
                                        p.mins !== "—" &&
                                        Number(p.mins) > 0
                                    )
                                    .map((p: any, idx: number) => (
                                    <div
                                      key={p.id}
                                      className="rounded-lg border border-border/40 bg-card/80 p-3 shadow-sm"
                                      style={{
                                        background:
                                          idx % 2 === 0
                                            ? "linear-gradient(90deg, rgba(139,92,246,0.08), transparent)"
                                            : "linear-gradient(90deg, rgba(139,92,246,0.04), transparent)",
                                      }}
                                    >
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-3">
                                          {p.headshot ? (
                                            <img
                                              src={p.headshot}
                                              alt={p.name}
                                              className="h-10 w-10 rounded-full object-cover"
                                            />
                                          ) : (
                                            <div className="h-10 w-10 rounded-full bg-muted" />
                                          )}
                                          <div className="text-foreground font-semibold leading-tight text-lg break-words">
                                            {(() => {
                                              if (!p.name) return "";
                                              const parts = String(p.name).split(" ");
                                              if (parts.length > 1) {
                                                return `${parts[0]}\n${parts.slice(1).join(" ")}`;
                                              }
                                              return p.name;
                                            })()}
                                          </div>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                          MIN: <span className="text-foreground font-semibold">{p.mins ?? "—"}</span>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                                        <div className="rounded-md bg-muted/20 px-2 py-2 text-center">
                                          <div className="text-[11px] uppercase tracking-wide font-semibold">PTS</div>
                                          <div className="text-lg font-bold text-foreground">
                                            {p.pts ?? "—"}
                                          </div>
                                        </div>
                                        <div className="rounded-md bg-muted/20 px-2 py-2 text-center">
                                          <div className="text-[11px] uppercase tracking-wide font-semibold">REB</div>
                                          <div className="text-lg font-bold text-foreground">
                                            {p.reb ?? "—"}
                                          </div>
                                        </div>
                                        <div className="rounded-md bg-muted/20 px-2 py-2 text-center">
                                          <div className="text-[11px] uppercase tracking-wide font-semibold">AST</div>
                                          <div className="text-lg font-bold text-foreground">
                                            {p.ast ?? "—"}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                ))
                                : awayPlayers
                                    .filter(
                                      (p: any) =>
                                        p.mins !== null &&
                                        p.mins !== undefined &&
                                        p.mins !== "—" &&
                                        Number(p.mins) > 0
                                    )
                                    .map((p: any, idx: number) => (
                                      <div
                                        key={p.id}
                                        className="rounded-lg border border-border/40 bg-card/80 p-3 shadow-sm"
                                        style={{
                                          background:
                                            idx % 2 === 0
                                              ? "linear-gradient(90deg, rgba(139,92,246,0.08), transparent)"
                                              : "linear-gradient(90deg, rgba(139,92,246,0.04), transparent)",
                                        }}
                                      >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                          <div className="flex items-center gap-3">
                                            {p.headshot ? (
                                              <img
                                                src={p.headshot}
                                                alt={p.name}
                                                className="h-10 w-10 rounded-full object-cover"
                                              />
                                            ) : (
                                              <div className="h-10 w-10 rounded-full bg-muted" />
                                            )}
                                            <div className="text-foreground font-semibold leading-tight text-lg break-words">
                                              {(() => {
                                                if (!p.name) return "";
                                                const parts = String(p.name).split(" ");
                                                if (parts.length > 1) {
                                                  return `${parts[0]}\n${parts.slice(1).join(" ")}`;
                                                }
                                                return p.name;
                                              })()}
                                            </div>
                                          </div>
                                          <div className="text-sm text-muted-foreground">
                                            MIN: <span className="text-foreground font-semibold">{p.mins ?? "—"}</span>
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                                          <div className="rounded-md bg-muted/20 px-2 py-2 text-center">
                                            <div className="text-[11px] uppercase tracking-wide font-semibold">PTS</div>
                                            <div className="text-lg font-bold text-foreground">
                                              {p.pts ?? "—"}
                                            </div>
                                          </div>
                                          <div className="rounded-md bg-muted/20 px-2 py-2 text-center">
                                            <div className="text-[11px] uppercase tracking-wide font-semibold">REB</div>
                                            <div className="text-lg font-bold text-foreground">
                                              {p.reb ?? "—"}
                                            </div>
                                          </div>
                                          <div className="rounded-md bg-muted/20 px-2 py-2 text-center">
                                            <div className="text-[11px] uppercase tracking-wide font-semibold">AST</div>
                                            <div className="text-lg font-bold text-foreground">
                                              {p.ast ?? "—"}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                            </div>
                          </div>
                        </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
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
                  const networks = getNetworks(competition);
                  const mergedNetworks =
                    networks.length > 0
                      ? networks
                      : coverageNetworks[event.id] || [];

                if (!opponent) return null;

                return (
                  <Card
                      key={event.id}
                      className="bg-card border border-border/40 rounded-2xl shadow-sm"
                    >
                      <CardHeader className="pb-4 space-y-3">
                        <div className="text-center text-sm font-semibold text-foreground">
                          {new Date(event.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="flex items-center justify-between gap-6">
                          <div className="flex items-center gap-3">
                            {uconnTeam?.team?.logos?.[0]?.href && (
                              <img
                                src={uconnTeam.team.logos[0].href}
                                alt="UConn"
                                className="h-12 w-12 rounded-[10px] object-contain"
                              />
                            )}
                            <div className="text-left space-y-1">
                              <div
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                  uconnTeam?.homeAway === "home"
                                    ? "bg-emerald-500 text-white"
                                    : "bg-rose-500 text-white"
                                }`}
                              >
                                {uconnTeam?.homeAway === "home" ? "HOME" : "AWAY"}
                              </div>
                              <p className="text-lg font-bold text-foreground">
                                UConn Huskies
                              </p>
                            </div>
                          </div>
                          <div className="text-sm font-semibold uppercase text-muted-foreground">
                            vs
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right space-y-1">
                              <div
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                  uconnTeam?.homeAway === "home"
                                    ? "bg-rose-500 text-white"
                                    : "bg-emerald-500 text-white"
                                }`}
                              >
                                {uconnTeam?.homeAway === "home" ? "AWAY" : "HOME"}
                              </div>
                              <p className="text-lg font-bold text-foreground">
                                {opponent.team.displayName}
                              </p>
                            </div>
                            {opponent?.team?.logos?.[0]?.href && (
                              <img
                                src={opponent.team.logos[0].href}
                                alt={opponent.team.displayName}
                                className="h-12 w-12 rounded-[10px] object-contain"
                              />
                            )}
                          </div>
                        </div>
                        <div className="px-2">
                          <div className="mt-1 flex items-center flex-wrap gap-2">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">
                              Watch on
                            </span>
                            {mergedNetworks.length > 0 ? (
                              Array.from(new Set(mergedNetworks)).map((n) => (
                                <span key={n} className="inline-flex items-center">
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
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">TBD</span>
                            )}
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
