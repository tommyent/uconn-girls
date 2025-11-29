export interface Team {
  id: string;
  displayName: string;
  shortDisplayName: string;
  logo: string;
  color: string;
  score?: string;
  record?: string;
}

export interface GameStatus {
  type: {
    id: string;
    name: string;
    state: string;
    completed: boolean;
  };
  displayClock: string;
  period: number;
}

export interface Game {
  id: string;
  date: string;
  status: GameStatus;
  homeTeam: Team;
  awayTeam: Team;
  venue?: {
    fullName: string;
  };
  broadcasts?: Array<{
    names: string[];
  }>;
}

export interface Player {
  id: string;
  displayName: string;
  shortName: string;
  position: string;
  jersey: string;
  headshot?: string;
  stats?: {
    [key: string]: number | string;
  };
}

export interface TeamStats {
  points: number;
  fieldGoalPct: number;
  threePointPct: number;
  freeThrowPct: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
}
