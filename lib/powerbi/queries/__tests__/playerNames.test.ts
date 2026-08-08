import { describe, expect, it } from "vitest";

import {
  extractPlayerNamesFromRows,
  mergePowerBiPlayerCandidates,
  resolvePowerBiPlayerCandidate,
} from "@/lib/powerbi/queries/playerNames";
import { pickRowValue } from "@/lib/powerbi/queries/rowUtils";

describe("mergePowerBiPlayerCandidates", () => {
  it("preserves exact names including internal double spaces", () => {
    const merged = mergePowerBiPlayerCandidates(
      ["Gabriel  Pacurar", "Carl Davordzie"],
      ["Gabriel  Pacurar", "Adnan Aganovic"]
    );

    expect(merged).toEqual([
      {
        playerName: "Adnan Aganovic",
        hasTrainingData: false,
        hasMatchBest: true,
      },
      {
        playerName: "Carl Davordzie",
        hasTrainingData: true,
        hasMatchBest: false,
      },
      {
        playerName: "Gabriel  Pacurar",
        hasTrainingData: true,
        hasMatchBest: true,
      },
    ]);
  });

  it("marks GPS_Log-only players", () => {
    const merged = mergePowerBiPlayerCandidates(["Victor Daguin"], []);
    expect(merged).toEqual([
      {
        playerName: "Victor Daguin",
        hasTrainingData: true,
        hasMatchBest: false,
      },
    ]);
  });

  it("marks Match_Benchmark-only players", () => {
    const merged = mergePowerBiPlayerCandidates([], ["Joonas Tamm"]);
    expect(merged).toEqual([
      {
        playerName: "Joonas Tamm",
        hasTrainingData: false,
        hasMatchBest: true,
      },
    ]);
  });

  it("marks both-source players", () => {
    const merged = mergePowerBiPlayerCandidates(
      ["Carl Davordzie"],
      ["Carl Davordzie"]
    );
    expect(merged[0]).toEqual({
      playerName: "Carl Davordzie",
      hasTrainingData: true,
      hasMatchBest: true,
    });
  });

  it("drops empty and whitespace-only names", () => {
    const merged = mergePowerBiPlayerCandidates(["", "   ", "A"], ["", "B"]);
    expect(merged.map((c) => c.playerName)).toEqual(["A", "B"]);
  });

  it("does not collapse distinct case variants into one key", () => {
    const merged = mergePowerBiPlayerCandidates(["Alex", "alex"], []);
    expect(merged).toHaveLength(2);
  });
});

describe("resolvePowerBiPlayerCandidate", () => {
  const candidates = mergePowerBiPlayerCandidates(
    ["Gabriel  Pacurar", "O'Brien, José"],
    ["Gabriel  Pacurar", "O'Brien, José"]
  );

  it("returns the exact candidate row for an exact request", () => {
    const resolved = resolvePowerBiPlayerCandidate("Gabriel  Pacurar", candidates);
    expect(resolved?.playerName).toBe("Gabriel  Pacurar");
  });

  it("preserves punctuation and diacritics from the candidate", () => {
    const resolved = resolvePowerBiPlayerCandidate("O'Brien, José", candidates);
    expect(resolved?.playerName).toBe("O'Brien, José");
  });

  it("may resolve accidental outer whitespace on the request, but returns untrimmed candidate.playerName", () => {
    const resolved = resolvePowerBiPlayerCandidate(
      "  Gabriel  Pacurar  ",
      candidates
    );
    expect(resolved?.playerName).toBe("Gabriel  Pacurar");
    expect(resolved?.playerName).not.toBe("  Gabriel  Pacurar  ");
  });

  it("rejects case-changed guesses", () => {
    expect(
      resolvePowerBiPlayerCandidate("gabriel  pacurar", candidates)
    ).toBeNull();
  });

  it("rejects unknown transformed names", () => {
    expect(resolvePowerBiPlayerCandidate("Gabriel Pacurar", candidates)).toBeNull();
  });

  it("rejects whitespace-only requests", () => {
    expect(resolvePowerBiPlayerCandidate("   ", candidates)).toBeNull();
  });
});

describe("extractPlayerNamesFromRows", () => {
  it("reads Player from bracket or plain keys", () => {
    const names = extractPlayerNamesFromRows(
      [{ "[Player]": "A" }, { Player: "B" }],
      pickRowValue
    );
    expect(names).toEqual(["A", "B"]);
  });
});
