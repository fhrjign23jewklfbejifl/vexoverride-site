import { blankField, ZONES } from "./scoring.js";
import { emptyWorkspace } from "./store.js";
export function makeDemo() {
  const w = emptyWorkspace();
  w.team = "4330P";
  w.teamName = "RoboPigeons";
  let seed = 4330;
  const rand = (n) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed % n;
  };
  const teams = [
    ["4330P", "RoboPigeons"],
    ["100A", "Atlas"],
    ["200B", "Circuit Breakers"],
    ["300C", "Torque"],
    ["400D", "Aftershock"],
    ["500E", "Vector"],
    ["600F", "Overdrive"],
    ["700G", "Momentum"],
  ].map(([number, name]) => ({
    number,
    name,
    location: "Sample team",
    id: number,
  }));
  const event = {
    id: "demo-event",
    name: "Miami Practice Invitational",
    date: new Date().toISOString(),
    location: "Demonstration event · fictional results",
    teams,
    skills: [],
    source: "demo",
    loadedAt: new Date().toISOString(),
  };
  teams.forEach((t, i) => {
    event.skills.push(
      { team: { number: t.number }, type: "driver", score: 70 + rand(75) },
      { team: { number: t.number }, type: "programming", score: 25 + rand(65) },
    );
  });
  w.events = [event];
  w.activeEvent = event.id;
  for (let i = 0; i < 42; i++) {
    const type = i % 3 === 0 ? "head" : i % 3 === 1 ? "driver" : "autonomous";
    const field = blankField();
    const total = type === "autonomous" ? 8 + rand(9) : 12 + rand(13);
    for (let j = 0; j < total; j++) {
      const z = ZONES[rand(5)];
      const c =
        type === "head"
          ? ["red", "blue", "yellow"][rand(3)]
          : z === "center"
            ? ["red", "blue", "yellow"][rand(3)]
            : rand(2)
              ? ["top", "right"].includes(z)
                ? "blue"
                : "red"
              : "yellow";
      field.zones[z][c]++;
    }
    for (const z of ZONES)
      field.zones[z].toggle = ["red", "blue", "neutral"][rand(3)];
    field.robots = { red: rand(3), blue: rand(3) };
    field.skillsRobot = rand(4) !== 0;
    field.auton = ["red", "blue", "tie", "none"][rand(4)];
    w.records.push({
      id: "sample-" + i,
      createdAt: new Date(Date.now() - ((42 - i) * 86400000) / 2).toISOString(),
      type,
      field,
      team: w.team,
      alliance: i % 2 ? "red" : "blue",
      eventId: "",
      label: "Practice " + (i + 1),
      notes: i % 4 === 0 ? "Test a repeatable midfield approach." : "",
      source: "demo",
      stopTime: null,
      route: i < 21 ? "Route A" : "Route B",
    });
  }
  for (let i = 0; i < 22; i++)
    w.observations.push({
      id: "observation-" + i,
      team: teams[1 + rand(7)].number,
      eventId: event.id,
      createdAt: new Date().toISOString(),
      match: "Q" + (i + 1),
      auton: ["success", "fail", "unknown"][rand(3)],
      midfield: ["yes", "no", "unknown"][rand(3)],
      reliability: rand(5) ? "clean" : "issue",
      defense: ["strong", "mixed", "weak", "unknown"][rand(4)],
      notes: [
        "Steady pin placement; discuss autonomous lanes.",
        "Quick toggle access. Watch the midfield approach.",
        "Recovered after a missed pickup.",
        "No additional notes.",
      ][rand(4)],
      source: "demo",
    });
  w.picks[event.id] = ["400D", "200B", "600F", "300C"].map((team) => ({
    team,
    status: "available",
  }));
  w.schedules = [
    {
      id: "schedule-1",
      eventId: event.id,
      label: "Q12",
      field: "Field 1",
      time: "10:40",
      red: ["4330P", "200B"],
      blue: ["400D", "600F"],
    },
    {
      id: "schedule-2",
      eventId: event.id,
      label: "Q18",
      field: "Field 2",
      time: "11:20",
      red: ["100A", "500E"],
      blue: ["4330P", "300C"],
    },
  ];
  return w;
}
