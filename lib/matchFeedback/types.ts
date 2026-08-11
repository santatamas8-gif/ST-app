import type { PhysicalDropoff, PreMatchFeeling } from "./constants";

export type MatchFeedbackMatch = {
  id: string;
  opponent: string;
  match_date: string;
  matchday: number;
  created_by: string;
  created_at: string;
};

export type MatchFeedbackParticipant = {
  match_id: string;
  player_id: string;
  created_at: string;
};

export type MatchFeedbackResponse = {
  id: string;
  match_id: string;
  player_id: string;
  pre_match_feelings: PreMatchFeeling[];
  pre_match_other_text: string | null;
  physical_demand: number;
  performance_rating: number;
  physical_dropoff: PhysicalDropoff;
  mental_demand: number;
  created_at: string;
  updated_at: string;
};

export type MatchFeedbackListItem = MatchFeedbackMatch & {
  participant_count: number;
  response_count: number;
};

export type MatchFeedbackCreateRequest = {
  opponent: string;
  matchDate: string;
  matchday: number;
  playerIds: string[];
};

export type MatchFeedbackSubmitRequest = {
  matchId: string;
  playerId: string;
  preMatchFeelings: PreMatchFeeling[];
  preMatchOtherText?: string | null;
  physicalDemand: number;
  performanceRating: number;
  physicalDropoff: PhysicalDropoff;
  mentalDemand: number;
};
