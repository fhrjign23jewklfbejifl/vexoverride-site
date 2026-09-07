import "../analysis-coach.js";

const coach = globalThis.VexAnalysisCoach;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function headRow(overrides = {}) {
  return {
    score: 120,
    margin: 18,
    result: "win",
    autonOutcome: "win",
    centerControlled: true,
    ourMidfieldRobots: 1,
    opponentMidfieldRobots: 0,
    yellowPlaced: 4,
    yellowOwned: 4,
    opponentYellowOwned: 0,
    alliancePins: 14,
    opponentPins: 8,
    zoneMissedYellow: { top: 0, right: 0, bottom: 0, left: 0 },
    ...overrides
  };
}

function skillsRow(overrides = {}) {
  return {
    type: "driver",
    score: 100,
    yellowPlaced: 4,
    yellowScored: 4,
    centerComplete: true,
    centerPotentialPoints: 8,
    misplacedPins: {
      red: { top: 0, right: 0, bottom: 0, left: 0, center: 0 },
      blue: { top: 0, right: 0, bottom: 0, left: 0, center: 0 }
    },
    ...overrides
  };
}

function expectHead(key, rows) {
  const result = coach.selectHeadRecommendation(rows);
  assert(result.ready, `${key}: expected a recommendation, got ${result.reason}`);
  assert(result.key === key, `${key}: received ${result.key}`);
}

function expectSkills(key, rows) {
  const result = coach.selectSkillsRecommendation(rows);
  assert(result.ready, `${key}: expected a recommendation, got ${result.reason}`);
  assert(result.key === key, `${key}: received ${result.key}`);
}

const headBase = Array.from({ length: 10 }, (_, index) => headRow({ score: 116 + index, margin: 14 + index }));

expectHead("headAutonCode", headBase.map((row, index) => index < 4 ? headRow({ ...row, autonOutcome: "loss", result: "loss", margin: -14 }) : row));
expectHead("headHoldAuton", headBase.map((row, index) => headRow({ ...row, autonOutcome: index < 7 ? "win" : "tie", result: index < 3 ? "win" : "loss", margin: index < 3 ? 12 : -8 })));
expectHead("headMidfield", headBase.map((row, index) => headRow({ ...row, centerControlled: index < 4, margin: index < 4 ? 28 : 2, score: index < 4 ? 138 : 108 })));
expectHead("headYellow", headBase.map((row, index) => headRow({ ...row, yellowPlaced: 5, yellowOwned: 3, zoneMissedYellow: { top: index % 4 === 0 ? 1 : 0, right: index % 4 === 1 ? 1 : 0, bottom: index % 4 === 2 ? 1 : 0, left: index % 4 === 3 ? 1 : 0 } })));
expectHead("headToggleZone", headBase.map((row, index) => headRow({ ...row, yellowPlaced: 5, yellowOwned: index < 6 ? 3 : 5, zoneMissedYellow: { top: index < 6 ? 2 : 0, right: 0, bottom: 0, left: 0 } })));
expectHead("headEndgame", headBase.map((row, index) => headRow({ ...row, autonOutcome: "tie", centerControlled: true, ourMidfieldRobots: index < 4 ? 0 : 1, result: index < 4 ? "loss" : "win", margin: index < 4 ? -6 : 12 })));
expectHead("headPins", headBase.map((row, index) => headRow({ ...row, autonOutcome: "tie", result: index < 5 ? "win" : "loss", alliancePins: index < 5 ? 17 : 10, score: index < 5 ? 130 : 105, margin: index < 5 ? 20 : -12 })));

const balancedMissing = Array.from({ length: 8 }, (_, index) => skillsRow({ type: index < 7 ? "driver" : "autonomous" }));
expectSkills("skillsBalance", balancedMissing);

const stableAuton = Array.from({ length: 5 }, (_, index) => skillsRow({ type: "autonomous", score: 88 + index }));
const stableDriver = Array.from({ length: 5 }, (_, index) => skillsRow({ type: "driver", score: 98 + index }));
expectSkills("skillsDriverRepeat", [...stableAuton, ...stableDriver.map((row, index) => ({ ...row, score: index < 3 ? 55 + index * 5 : 105 }))]);
expectSkills("skillsAutonRepeat", [...stableDriver, ...stableAuton.map((row, index) => ({ ...row, score: index < 3 ? 35 + index * 5 : 100 }))]);
expectSkills("skillsRouteGain", [
  ...stableDriver.map((row, index) => ({ ...row, score: index < 3 ? 45 : 110 })),
  ...stableAuton.map((row, index) => ({ ...row, score: index < 3 ? 72 : 105 }))
]);
expectSkills("skillsYellow", [...stableDriver, ...stableAuton].map(row => skillsRow({ ...row, yellowPlaced: 5, yellowScored: 3 })));
expectSkills("skillsCenter", [...stableDriver, ...stableAuton].map((row, index) => skillsRow({ ...row, centerComplete: index < 5, centerPotentialPoints: 28, score: index < 5 ? 115 : 92 })));
expectSkills("skillsPlacement", [...stableDriver, ...stableAuton].map((row, index) => skillsRow({ ...row, misplacedPins: { ...row.misplacedPins, red: { ...row.misplacedPins.red, top: index < 5 ? 5 : 0 } } })));
expectSkills("skillsEventSet", [
  ...Array.from({ length: 6 }, (_, index) => skillsRow({ type: "driver", score: index === 5 ? 140 : 100 })),
  ...Array.from({ length: 6 }, (_, index) => skillsRow({ type: "autonomous", score: 92 + (index % 2) }))
]);
expectSkills("skillsCeiling", [...stableDriver, ...stableAuton]);

const headInsufficient = coach.selectHeadRecommendation(headBase.slice(0, 6));
assert(!headInsufficient.ready && headInsufficient.reason === "headCount", "Head-on-head sample gate failed");
const skillsInsufficient = coach.selectSkillsRecommendation(stableDriver.slice(0, 4));
assert(!skillsInsufficient.ready && skillsInsufficient.reason === "skillsCount", "Skills sample gate failed");

console.log("Analysis coach fixtures passed: 16 recommendations plus evidence gates.");
