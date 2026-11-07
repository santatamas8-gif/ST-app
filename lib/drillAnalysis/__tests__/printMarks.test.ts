import { describe, expect, it } from "vitest";
import { comparePrintMarks } from "@/lib/drillAnalysis/printMarks";

describe("comparePrintMarks", () => {
  it("builds monograms from the first and last word", () => {
    expect(comparePrintMarks("Adnan Aganovic", "Akos Nistor")).toEqual(["AA", "AN"]);
    expect(comparePrintMarks("Boris Cmiljanic", "Moses Mawa")).toEqual(["BC", "MM"]);
  });

  it("keeps each monogram with that player when the pair is swapped", () => {
    expect(comparePrintMarks("Akos Nistor", "Adnan Aganovic")).toEqual(["AN", "AA"]);
    expect(comparePrintMarks("Moses Mawa", "Boris Cmiljanic")).toEqual(["MM", "BC"]);
  });

  it("uses the first two letters of a single name", () => {
    expect(comparePrintMarks("Moses", "Akos Nistor")).toEqual(["MO", "AN"]);
  });

  it("ignores extra spaces and uses the outer words", () => {
    expect(comparePrintMarks("  Adnan   Aganovic  ", "Jean Pierre Papin")).toEqual(["AA", "JP"]);
  });

  it("lengthens the surname when monograms match", () => {
    expect(comparePrintMarks("Adnan Aganovic", "Adam Anderson")).toEqual(["AAG", "AAN"]);
    expect(comparePrintMarks("Adam Anderson", "Adnan Aganovic")).toEqual(["AAN", "AAG"]);
  });

  it("lengthens the first name when the surnames match", () => {
    expect(comparePrintMarks("John Smith", "James Smith")).toEqual(["JOS", "JAS"]);
    expect(comparePrintMarks("Moses Mawa", "Martin Mawa")).toEqual(["MOM", "MAM"]);
    expect(comparePrintMarks("Martin Mawa", "Moses Mawa")).toEqual(["MAM", "MOM"]);
  });
});
