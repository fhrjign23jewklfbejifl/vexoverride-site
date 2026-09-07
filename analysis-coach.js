"use strict";

(function attachAnalysisCoach(root) {
  const HEAD_MIN_RECORDS = 10;
  const SKILLS_MIN_RECORDS = 5;
  const GROUP_MIN_RECORDS = 4;
  const OUTER_ZONES = ["top", "right", "bottom", "left"];

  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const average = values => values.length ? values.reduce((total, value) => total + number(value), 0) / values.length : null;
  const sortedValues = values => values.map(number).sort((a, b) => a - b);
  const median = values => {
    const sorted = sortedValues(values);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const percentile = (values, portion) => {
    const sorted = sortedValues(values);
    if (!sorted.length) return null;
    const index = (sorted.length - 1) * portion;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  };
  const rate = (rows, predicate) => rows.length ? rows.filter(predicate).length / rows.length : 0;
  const confidenceWeight = count => Math.min(1, Math.sqrt(count / 20));

  function classifyTrajectory(inputValues) {
    const values = (Array.isArray(inputValues) ? inputValues : [])
      .map(value => Number(value))
      .filter(Number.isFinite);
    if (values.length < 4) {
      return { shape: "steady", tone: "flat", opening: average(values), current: average(values), delta: 0 };
    }

    const windowSize = Math.min(5, Math.max(2, Math.floor(values.length / 4)));
    const opening = average(values.slice(0, windowSize));
    const current = average(values.slice(-windowSize));
    const middleStart = Math.max(windowSize, Math.floor(values.length * .38));
    const middleEnd = Math.min(values.length - windowSize, Math.ceil(values.length * .68));
    const middle = average(values.slice(middleStart, Math.max(middleStart + 1, middleEnd)));
    const delta = current - opening;
    const recovered = Number.isFinite(middle)
      && middle <= Math.min(opening, current) - 8
      && current >= opening - 4
      && current - middle >= 12;

    if (recovered) return { shape: "recovery", tone: "up", opening, current, middle, delta };
    if (delta >= 24) return { shape: "strongUp", tone: "up", opening, current, middle, delta };
    if (delta > 6) return { shape: "gradualUp", tone: "up", opening, current, middle, delta };
    if (delta < -6) return { shape: "decline", tone: "down", opening, current, middle, delta };
    return { shape: "steady", tone: "flat", opening, current, middle, delta };
  }

  function comparison(rows, predicate, getter = row => row.score) {
    const positive = rows.filter(predicate);
    const negative = rows.filter(row => !predicate(row));
    if (positive.length < GROUP_MIN_RECORDS || negative.length < GROUP_MIN_RECORDS) return null;
    const positiveValue = average(positive.map(getter));
    const negativeValue = average(negative.map(getter));
    return {
      positiveCount: positive.length,
      negativeCount: negative.length,
      positiveValue,
      negativeValue,
      swing: positiveValue - negativeValue
    };
  }

  function candidate(key, impact, frequency, count, evidence = {}, compare = null, weight = 1) {
    return {
      key,
      impact,
      frequency,
      priority: Math.max(0, impact) * Math.max(.2, frequency) * confidenceWeight(count) * weight,
      evidence,
      comparison: compare
    };
  }

  function signalResult(rows, candidates, mode) {
    const chosen = candidates
      .filter(item => item && Number.isFinite(item.priority) && item.priority > 0)
      .sort((a, b) => b.priority - a.priority)[0];
    if (!chosen) {
      return { ready: false, mode, reason: "noSignal", count: rows.length, needed: 0 };
    }
    return {
      ready: true,
      mode,
      count: rows.length,
      confidence: rows.length >= 20 ? "strong" : "developing",
      ...chosen
    };
  }

  function selectHeadRecommendation(inputRows) {
    const rows = Array.isArray(inputRows) ? inputRows : [];
    if (rows.length < HEAD_MIN_RECORDS) {
      return { ready: false, mode: "head", reason: "headCount", count: rows.length, needed: HEAD_MIN_RECORDS - rows.length };
    }

    const candidates = [];
    const scores = rows.map(row => row.score);
    const wins = rows.filter(row => row.result === "win");
    const losses = rows.filter(row => row.result === "loss");
    const autonSuccessful = row => row.autonOutcome === "win" || row.autonOutcome === "tie";
    const autonSuccessRate = rate(rows, autonSuccessful);
    const autonFailures = rows.filter(row => !autonSuccessful(row)).length;
    const autonCompare = comparison(rows, autonSuccessful, row => row.margin);

    if (autonSuccessRate < .8 && autonFailures >= 3) {
      candidates.push(candidate("headAutonCode", (1 - autonSuccessRate) * 12, 1 - autonSuccessRate, rows.length, {
        successCount: rows.length - autonFailures,
        failureCount: autonFailures,
        rate: autonSuccessRate,
        marginSwing: autonCompare?.swing ?? null
      }, autonCompare && Math.abs(autonCompare.swing) >= 8 ? { ...autonCompare, positiveLabel: "autonSuccess", negativeLabel: "autonFailure", metric: "margin" } : null));
    }

    const autonWins = rows.filter(row => row.autonOutcome === "win");
    const convertedAutonWins = autonWins.filter(row => row.result === "win");
    const conversionRate = autonWins.length ? convertedAutonWins.length / autonWins.length : 1;
    if (autonWins.length >= 4 && autonWins.length - convertedAutonWins.length >= 3 && conversionRate < .7) {
      const convertedCompare = comparison(autonWins, row => row.result === "win", row => row.margin);
      candidates.push(candidate("headHoldAuton", (1 - conversionRate) * 12, autonWins.length / rows.length, rows.length, {
        autonWins: autonWins.length,
        converted: convertedAutonWins.length,
        rate: conversionRate
      }, convertedCompare ? { ...convertedCompare, positiveLabel: "converted", negativeLabel: "gaveBack", metric: "margin" } : null, 1.08));
    }

    const centerRate = rate(rows, row => row.centerControlled);
    const centerCompare = comparison(rows, row => row.centerControlled, row => row.margin);
    if (centerRate < .8 && centerCompare && centerCompare.swing >= 8) {
      candidates.push(candidate("headMidfield", centerCompare.swing, 1 - centerRate, rows.length, {
        rate: centerRate,
        marginSwing: centerCompare.swing
      }, { ...centerCompare, positiveLabel: "centerOwned", negativeLabel: "centerNotOwned", metric: "margin" }));
    }

    const totalYellow = rows.reduce((total, row) => total + number(row.yellowPlaced), 0);
    const ownedYellow = rows.reduce((total, row) => total + number(row.yellowOwned), 0);
    const yellowRate = totalYellow ? ownedYellow / totalYellow : 1;
    const missedYellowPoints = average(rows.map(row => Math.max(0, number(row.yellowPlaced) - number(row.yellowOwned)) * 10));
    const yellowCompare = comparison(rows, row => row.yellowPlaced > 0 && row.yellowOwned / row.yellowPlaced >= .85, row => row.score);
    if (totalYellow >= rows.length && yellowRate < .85 && missedYellowPoints >= 8) {
      candidates.push(candidate("headYellow", missedYellowPoints, 1 - yellowRate, rows.length, {
        placed: totalYellow,
        scored: ownedYellow,
        rate: yellowRate,
        missedPoints: missedYellowPoints
      }, yellowCompare && yellowCompare.swing >= 8 ? { ...yellowCompare, positiveLabel: "yellowConverted", negativeLabel: "yellowMissed", metric: "score" } : null));
    }

    const zoneTotals = OUTER_ZONES.map(zone => {
      const missed = rows.map(row => number(row.zoneMissedYellow?.[zone]));
      return {
        zone,
        pins: missed.reduce((total, value) => total + value, 0),
        occurrences: missed.filter(value => value > 0).length,
        averagePoints: average(missed) * 10
      };
    }).sort((a, b) => b.pins - a.pins);
    const worstZone = zoneTotals[0];
    const allZoneMisses = zoneTotals.reduce((total, zone) => total + zone.pins, 0);
    if (worstZone?.occurrences >= 3 && worstZone.averagePoints >= 5 && worstZone.pins / Math.max(1, allZoneMisses) >= .4) {
      const zoneCompare = comparison(rows, row => number(row.zoneMissedYellow?.[worstZone.zone]) === 0, row => row.score);
      candidates.push(candidate("headToggleZone", worstZone.averagePoints, worstZone.occurrences / rows.length, rows.length, {
        zone: worstZone.zone,
        missedPins: worstZone.pins,
        missedPoints: worstZone.averagePoints
      }, zoneCompare && zoneCompare.swing >= 8 ? { ...zoneCompare, positiveLabel: "zoneSecured", negativeLabel: "zoneLost", metric: "score" } : null, 1.12));
    }

    const noMidfield = rows.filter(row => number(row.ourMidfieldRobots) === 0);
    const closeNoMidfieldLosses = noMidfield.filter(row => row.result === "loss" && Math.abs(number(row.margin)) <= 16);
    if (noMidfield.length >= 3 && closeNoMidfieldLosses.length >= 2) {
      const endgameCompare = comparison(rows, row => number(row.ourMidfieldRobots) > 0, row => row.margin);
      candidates.push(candidate("headEndgame", 8, noMidfield.length / rows.length, rows.length, {
        missedMatches: noMidfield.length,
        closeLosses: closeNoMidfieldLosses.length,
        missedPoints: 8
      }, endgameCompare && endgameCompare.swing >= 8 ? { ...endgameCompare, positiveLabel: "midfieldFinish", negativeLabel: "noMidfieldFinish", metric: "margin" } : null));
    }

    if (wins.length >= GROUP_MIN_RECORDS && losses.length >= GROUP_MIN_RECORDS) {
      const winningPins = average(wins.map(row => row.alliancePins));
      const losingPins = average(losses.map(row => row.alliancePins));
      const pinGap = winningPins - losingPins;
      if (pinGap >= 2 && centerRate >= .6 && yellowRate >= .75) {
        candidates.push(candidate("headPins", pinGap * 5, losses.length / rows.length, rows.length, {
          winningPins,
          losingPins,
          pinGap
        }, {
          positiveCount: wins.length,
          negativeCount: losses.length,
          positiveValue: winningPins,
          negativeValue: losingPins,
          swing: pinGap,
          positiveLabel: "wins",
          negativeLabel: "losses",
          metric: "pins"
        }));
      }

    }

    return signalResult(rows, candidates, "head");
  }

  function routeStats(rows) {
    const scores = rows.map(row => row.score);
    const best = scores.length ? Math.max(...scores) : null;
    const middle = median(scores);
    const floor = percentile(scores, .2);
    return { count: rows.length, best, median: middle, floor, gap: best - middle };
  }

  function selectSkillsRecommendation(inputRows) {
    const rows = Array.isArray(inputRows) ? inputRows : [];
    if (rows.length < SKILLS_MIN_RECORDS) {
      return { ready: false, mode: "skills", reason: "skillsCount", count: rows.length, needed: SKILLS_MIN_RECORDS - rows.length };
    }
    const driver = rows.filter(row => row.type === "driver");
    const auton = rows.filter(row => row.type === "autonomous");
    if (driver.length < SKILLS_MIN_RECORDS || auton.length < SKILLS_MIN_RECORDS) {
      return signalResult(rows, [candidate("skillsBalance", 12, 1, rows.length, {
        driverCount: driver.length,
        autonCount: auton.length,
        neededDriver: Math.max(0, SKILLS_MIN_RECORDS - driver.length),
        neededAuton: Math.max(0, SKILLS_MIN_RECORDS - auton.length)
      }, null, 1.4)], "skills");
    }

    const candidates = [];
    const driverStats = routeStats(driver);
    const autonStats = routeStats(auton);
    const driverUnstable = driverStats.gap >= Math.max(10, driverStats.best * .15);
    const autonUnstable = autonStats.gap >= Math.max(10, autonStats.best * .15);

    if (driverUnstable && autonUnstable && Math.abs(driverStats.gap - autonStats.gap) >= 5) {
      const route = driverStats.gap > autonStats.gap ? "driver" : "autonomous";
      const stats = route === "driver" ? driverStats : autonStats;
      candidates.push(candidate("skillsRouteGain", stats.gap, .5, rows.length, {
        route,
        best: stats.best,
        median: stats.median,
        gap: stats.gap,
        target: stats.median + stats.gap / 2
      }, null, 1.12));
    } else {
      if (driverUnstable) {
        candidates.push(candidate("skillsDriverRepeat", driverStats.gap, .5, driver.length, {
          best: driverStats.best,
          median: driverStats.median,
          gap: driverStats.gap
        }));
      }
      if (autonUnstable) {
        candidates.push(candidate("skillsAutonRepeat", autonStats.gap, .5, auton.length, {
          best: autonStats.best,
          median: autonStats.median,
          gap: autonStats.gap
        }));
      }
    }

    const yellowPlaced = rows.reduce((total, row) => total + number(row.yellowPlaced), 0);
    const yellowScored = rows.reduce((total, row) => total + number(row.yellowScored), 0);
    const yellowRate = yellowPlaced ? yellowScored / yellowPlaced : 1;
    const missedYellowPoints = average(rows.map(row => Math.max(0, number(row.yellowPlaced) - number(row.yellowScored)) * 10));
    const yellowCompare = comparison(rows, row => row.yellowPlaced > 0 && row.yellowScored / row.yellowPlaced >= .9, row => row.score);
    if (yellowPlaced >= rows.length && yellowRate < .9 && missedYellowPoints >= 8) {
      candidates.push(candidate("skillsYellow", missedYellowPoints, 1 - yellowRate, rows.length, {
        placed: yellowPlaced,
        scored: yellowScored,
        rate: yellowRate,
        missedPoints: missedYellowPoints
      }, yellowCompare && yellowCompare.swing >= 8 ? { ...yellowCompare, positiveLabel: "yellowConverted", negativeLabel: "yellowMissed", metric: "score" } : null));
    }

    const centerMisses = rows.filter(row => !row.centerComplete);
    const centerCompare = comparison(rows, row => row.centerComplete, row => row.score);
    const centerMissedPoints = average(rows.map(row => row.centerComplete ? 0 : number(row.centerPotentialPoints || 8)));
    if (centerMisses.length >= 3 && centerMisses.length / rows.length >= .25 && centerMissedPoints >= 4) {
      candidates.push(candidate("skillsCenter", Math.max(8, centerMissedPoints), centerMisses.length / rows.length, rows.length, {
        completeCount: rows.length - centerMisses.length,
        total: rows.length,
        rate: 1 - centerMisses.length / rows.length,
        missedPoints: centerMissedPoints
      }, centerCompare && centerCompare.swing >= 8 ? { ...centerCompare, positiveLabel: "centerComplete", negativeLabel: "centerMissed", metric: "score" } : null));
    }

    const placementTotals = [];
    ["red", "blue"].forEach(color => {
      ["top", "right", "bottom", "left", "center"].forEach(zone => {
        const pins = rows.reduce((total, row) => total + number(row.misplacedPins?.[color]?.[zone]), 0);
        const occurrences = rows.filter(row => number(row.misplacedPins?.[color]?.[zone]) > 0).length;
        placementTotals.push({ color, zone, pins, occurrences, averagePoints: pins * 5 / rows.length });
      });
    });
    const placement = placementTotals.sort((a, b) => b.pins - a.pins)[0];
    if (placement?.pins >= 3 && placement.occurrences >= 2 && placement.averagePoints >= 3) {
      candidates.push(candidate("skillsPlacement", placement.averagePoints, placement.occurrences / rows.length, rows.length, {
        color: placement.color,
        zone: placement.zone,
        pins: placement.pins,
        missedPoints: placement.averagePoints
      }, null, 1.15));
    }

    const riskyRoutes = [
      { route: "driver", rows: driver, stats: driverStats },
      { route: "autonomous", rows: auton, stats: autonStats }
    ].filter(item => item.rows.length >= 6).map(item => {
      const sorted = sortedValues(item.rows.map(row => row.score)).reverse();
      const second = sorted[1];
      return { ...item, second, gap: item.stats.best - second, ratio: item.stats.best ? second / item.stats.best : 1 };
    }).sort((a, b) => b.gap - a.gap);
    const risky = riskyRoutes[0];
    if (risky && risky.ratio < .9 && risky.stats.best > risky.stats.median * 1.15) {
      candidates.push(candidate("skillsEventSet", risky.gap, .34, risky.rows.length, {
        route: risky.route,
        best: risky.stats.best,
        second: risky.second,
        gap: risky.gap
      }, null, 1.7));
    }

    const stableRoutes = [
      { route: "driver", stats: driverStats },
      { route: "autonomous", stats: autonStats }
    ].filter(item => item.stats.floor >= item.stats.best * .82 && item.stats.gap < Math.max(10, item.stats.best * .12));
    if (stableRoutes.length) {
      const stable = stableRoutes.sort((a, b) => b.stats.median - a.stats.median)[0];
      candidates.push(candidate("skillsCeiling", Math.max(5, stable.stats.best * .08), 1, rows.length, {
        route: stable.route,
        best: stable.stats.best,
        median: stable.stats.median,
        target: stable.stats.median * 1.08
      }, null, .65));
    }

    return signalResult(rows, candidates, "skills");
  }

  root.VexAnalysisCoach = Object.freeze({
    HEAD_MIN_RECORDS,
    SKILLS_MIN_RECORDS,
    GROUP_MIN_RECORDS,
    classifyTrajectory,
    selectHeadRecommendation,
    selectSkillsRecommendation
  });
})(globalThis);
