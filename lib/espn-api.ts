const ESPN_BASE_URL = 'http://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball';
const UCONN_TEAM_ID = '41';

// ESPN season queries expect the season end year (e.g., 2026 for the 2025-26 season).
const getCurrentSeasonEndYear = () => {
  const today = new Date();
  return today.getMonth() >= 6 ? today.getFullYear() + 1 : today.getFullYear();
};

export async function getUConnTeamInfo() {
  const response = await fetch(`${ESPN_BASE_URL}/teams/${UCONN_TEAM_ID}`, {
    next: { revalidate: 300 }, // Revalidate every 5 minutes
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch team info');
  }
  
  return response.json();
}

export async function getTodaysScoreboard() {
  const response = await fetch(`${ESPN_BASE_URL}/scoreboard`, {
    next: { revalidate: 30 }, // Revalidate every 30 seconds for live scores
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch scoreboard');
  }
  
  return response.json();
}

export async function getScoreboardByDate(date: string) {
  // Format: YYYYMMDD
  const response = await fetch(`${ESPN_BASE_URL}/scoreboard?dates=${date}`, {
    next: { revalidate: 3600 }, // Historical data: revalidate every hour
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch scoreboard');
  }
  
  return response.json();
}

export async function getTeamSchedule(season?: string) {
  const seasonParam = season || new Date().getFullYear().toString();
  const response = await fetch(
    `${ESPN_BASE_URL}/teams/${UCONN_TEAM_ID}/schedule?season=${seasonParam}`,
    {
      next: { revalidate: 3600 }, // Revalidate every hour
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch schedule');
  }
  
  return response.json();
}

export async function getTeamRoster(season?: string) {
  const seasonParam = season || getCurrentSeasonEndYear().toString();
  const response = await fetch(
    `${ESPN_BASE_URL}/teams/${UCONN_TEAM_ID}/roster?season=${seasonParam}`,
    {
      next: { revalidate: 86400 }, // Revalidate every 24 hours
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch roster');
  }
  
  return response.json();
}

export async function getGameDetails(gameId: string) {
  const response = await fetch(`${ESPN_BASE_URL}/summary?event=${gameId}`, {
    next: { revalidate: 30 }, // Revalidate every 30 seconds for live games
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch game details');
  }
  
  return response.json();
}
