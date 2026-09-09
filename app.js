"use strict";

const POINTS = {
  auton: 12,
  autonTie: 6,
  alliancePin: 5,
  yellowPin: 10,
  midfieldRobot: 8
};

const MATCH_STORE_KEY = "vexOverrideMatches:v1";
const PROFILE_STORE_KEY = "vexOverrideProfile:v1";
const COMPETITION_STORE_KEY = "vexOverrideCompetitionData:v1";
const JUDGE_MATCH_STORE_KEY = "vexOverrideJudgeMatches:v1";
const JUDGE_PROFILE_STORE_KEY = "vexOverrideJudgeProfile:v1";
const JUDGE_COMPETITION_STORE_KEY = "vexOverrideJudgeCompetitionData:v1";
const JUDGE_DATASET_VERSION_STORE_KEY = "vexOverrideJudgeDatasetVersion:v1";
const JUDGE_DATASET_VERSION = "4330p-season-replay-20260908-v6";
const PROXY_URL_STORE_KEY = "vexOverrideDataProxyUrl:v1";
const SEASON_SKILLS_STORE_KEY = "vexOverrideSeasonSkills:v1";
const LANGUAGE_STORE_KEY = "vexOverrideLanguage:v1";
const DEV_AUTOFILL_STORE_KEY = "vexOverrideDevAutofill:v1";
const HISTORY_INITIAL_LIMIT = 3;
const DEFAULT_VEX_PROXY_URL = "https://vexoverride-data-proxy.nnovate--26.workers.dev";
const quadrants = ["top", "right", "bottom", "left", "center"];
const colors = ["yellow", "red", "blue"];
const toggleStates = ["neutral", "blue", "red"];

const state = {
  auton: "none",
  robots: {
    "red-1": false,
    "red-2": false,
    "blue-1": false,
    "blue-2": false
  },
  quadrants: Object.fromEntries(quadrants.map(name => [
    name,
    { toggle: "neutral", yellow: 0, red: 0, blue: 0 }
  ]))
};

const skillsQuadrants = ["top", "right", "bottom", "left", "center"];
const skillsState = {
  centerToggle: false,
  toggles: {
    top: "neutral",
    right: "neutral",
    bottom: "neutral",
    left: "neutral"
  },
  quadrants: Object.fromEntries(skillsQuadrants.map(name => [
    name,
    { yellow: 0, red: 0, blue: 0 }
  ]))
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const normalizedPagePath = window.location.pathname.replace(/\/+$/, "") || "/";
const isJudgeMode = normalizedPagePath === "/judge";
const isDevMode = !isJudgeMode && (new URLSearchParams(window.location.search).get("dev") === "1" || window.location.hash === "#dev");
let profile = loadProfile();
let activeMode = "head";
let analysisRange = "all";
let analysisMode = "head";
let headTrajectoryMetric = "score";
const analysisDisclosureState = {
  head: { evidence: false, correlation: false },
  skills: { evidence: false, correlation: false }
};
let replayObserver = null;
let devAutofillState = loadDevAutofillState();
let lastDevHeadRecommendation = devAutofillState.headRecommendation || "";
let lastDevSkillsRecommendation = devAutofillState.skillsRecommendation || "";
let headCorrelationX = "alliancePins";
let headCorrelationY = "ourScore";
let skillsCorrelationX = "redBluePins";
let skillsCorrelationY = "score";
let teamAlliance = "none";
let skillsRunType = "none";
let showAllHistory = false;
let showAllSkillsHistory = false;
let expandedMatchId = null;
let expandedSkillsRunId = null;
let editingMatchId = null;
let pendingDeleteMatchId = null;
let competitionSearchResults = [];
let importedCompetition = loadCompetitionData();
let syncedEvents = [];
let syncedEventsLoaded = false;
let syncedEventsError = null;
let syncedTeamIndexPromise = null;
let syncedTeamIndex = null;
let competitionQuickFilter = "all";
let competitionRegionOptions = [];
let selectedCompetitionRegion = "";
let highlightedRegionIndex = -1;
let pendingProfileMatch = null;
let teamSkillsResults = [];
let expandedTeamSkillId = null;
let expandedCompetitionTeam = null;
let seasonSkillsIndex = null;
let seasonSkillsPromise = null;
let judgeTeamIdentity = null;
let judgeSkillsLookupComplete = false;
let judgeScoutingPromise = null;
let lastModalFocus = null;
let toastTimer = null;
const REGION_MATCH_KEY = "__matching_regions__";
const supportedLanguages = ["en", "es", "zh-CN"];
const languageLocales = { en: "en-US", es: "es", "zh-CN": "zh-CN" };
const translations = {
  en: {
    "aria.appOverview": "App overview",
    "aria.savedSummary": "Saved match summary",
    "aria.scoringMode": "Scoring mode",
    "aria.skillsPanel": "Skills analysis and scorer",
    "aria.skillsReset": "Skills reset placeholder",
    "aria.skillsScore": "Skills score",
    "aria.skillsRunType": "Skills run type",
    "aria.resetScorer": "Reset scorer",
    "aria.liveScore": "Live score",
    "aria.closeSaveMatch": "Close save match dialog",
    "aria.closeSkillsSave": "Close skills save dialog",
    "aria.closeDevEdit": "Close dev edit dialog",
    "brand.title": "Override Scoring Analyzer",
    "brand.credit": "Made by - 4330P RoboPigeons",
    "banner.team": "Team",
    "banner.matches": "Matches",
    "banner.record": "Record",
    "judge.practiceMatches": "Practice matches",
    "judge.practiceRecord": "Practice record",
    "language.label": "Language",
    "language.aria": "Language",
    "tabs.head": "Head-on-head",
    "tabs.skills": "Skills",
    "tabs.scouting": "Scouting",
    "tabs.analysis": "Analysis",
    "range.today": "Today",
    "range.7": "7 days",
    "range.30": "30 days",
    "range.all": "All time",
    "range.custom": "Custom",
    "range.start": "Start",
    "range.end": "End",
    "common.optional": "Optional",
    "common.notListed": "Not listed",
    "common.notLoaded": "Not loaded",
    "common.notSaved": "Not saved",
    "common.notEntered": "Not entered",
    "common.cancel": "Cancel",
    "common.team": "Team",
    "color.red": "Red",
    "color.blue": "Blue",
    "color.yellow": "Yellow",
    "color.neutral": "Neutral",
    "quadrant.top": "top",
    "quadrant.right": "right",
    "quadrant.bottom": "bottom",
    "quadrant.left": "left",
    "quadrant.center": "center",
    "match.saveMatch": "Save Match",
    "match.redAuton": "Red auton",
    "match.blueAuton": "Blue auton",
    "skills.score": "Skills Score",
    "skills.driver": "Driver",
    "skills.autonomous": "Autonomous",
    "skills.saveRun": "Save Run",
    "history.matchTitle": "Match History",
    "history.matchDescription": "Recent saved matches on this device.",
    "history.matchEmpty": "Saved matches will appear here after you score and save one.",
    "history.skillsTitle": "Skills History",
    "history.skillsDescription": "Recent saved Skills runs on this device.",
    "history.skillsEmpty": "Saved Skills runs will appear here after you score and save one.",
    "history.showMore": "Show More",
    "history.showLess": "Show Less",
    "history.confirmDelete": "Confirm Delete",
    "history.deleteMatch": "Delete Match",
    "history.savedMatch": "Saved match",
    "history.result.saved": "saved",
    "history.result.win": "win",
    "history.result.loss": "loss",
    "history.result.tie": "tie",
    "history.team": "Team",
    "history.alliance": "Alliance",
    "history.ourScore": "Our score",
    "history.opponentScore": "Opponent score",
    "history.partner": "Partner",
    "history.opponentOne": "Opponent 1",
    "history.opponentTwo": "Opponent 2",
    "history.runType": "Run type",
    "history.notes": "Notes",
    "setup.title": "Team Setup",
    "setup.description": "Enter your team number once. This app will remember it on this device.",
    "setup.teamNumber": "Your team number",
    "setup.checkTeam": "Check Team",
    "setup.checking": "Checking...",
    "setup.teamFound": "Team found",
    "setup.yesContinue": "Yes, continue",
    "setup.noEdit": "No, edit team number",
    "saveMatch.title": "Save Match",
    "saveMatch.description": "All details are optional. The score and full field state are saved automatically.",
    "saveMatch.partnerTeam": "Alliance partner team number",
    "saveMatch.partnerNotes": "Alliance partner notes",
    "saveMatch.opponentOne": "Opponent 1 team number/name",
    "saveMatch.opponentOneNotes": "Opponent 1 notes",
    "saveMatch.opponentTwo": "Opponent 2 team number/name",
    "saveMatch.opponentTwoNotes": "Opponent 2 notes",
    "saveMatch.skip": "Skip Details",
    "saveSkills.title": "Save Skills Run",
    "saveSkills.description": "Notes are optional. The score and full Skills field state are saved automatically.",
    "saveSkills.notes": "Run notes",
    "saveSkills.skip": "Skip Notes",
    "dev.title": "Dev Mode",
    "dev.description": "Edit saved records or wipe local test data on this device.",
    "dev.autofill": "Autofill Sample Data",
    "dev.clearMatches": "Clear Matches",
    "dev.wipeAll": "Wipe All Data",
    "dev.generatedScenario": "Generated scenario",
    "dev.coachSelected": "Coach selected",
    "dev.seasonShape": "Season shape",
    "dev.selectorMismatch": "Generator mismatch",
    "dev.editTitle": "Edit Saved Match",
    "dev.editDescription": "Dev mode: edit the saved match JSON directly. Invalid JSON will not save.",
    "dev.saveChanges": "Save Changes",
    "dev.tools": "Dev tools",
    "dev.editJson": "Edit JSON",
    "analysis.kicker": "Local performance",
    "analysis.title": "My Performance",
    "analysis.description": "Score trends from saved matches and Skills runs on this device.",
    "analysis.rangeAria": "Analysis date range",
    "analysis.head.emptySummary": "Save matches to unlock head-on-head analysis.",
    "analysis.skills.emptySummary": "Save Skills runs to unlock Skills analysis.",
    "analysis.head.emptyPanel": "Save head-on-head matches to unlock this panel.",
    "analysis.skills.emptyPanel": "Save Skills runs to unlock this panel.",
    "analysis.noRange": "No saved data in this range.",
    "analysis.matches.one": "{count} match",
    "analysis.matches.many": "{count} matches",
    "analysis.runs.one": "{count} run",
    "analysis.runs.many": "{count} runs",
    "analysis.summaryAverage": "Averaging {score} points across this range.",
    "analysis.coachNote": "Coach note",
    "analysis.averageScore": "Average score",
    "analysis.winRate": "Win rate",
    "analysis.best": "Best",
    "analysis.median": "Median",
    "analysis.worst": "Worst",
    "analysis.last5": "Last 5 vs average",
    "analysis.trendTitle": "Are we improving?",
    "analysis.trendDetail.match": "Each dot is one saved match, oldest to newest.",
    "analysis.trendDetail.run": "Each dot is one saved run, oldest to newest.",
    "analysis.needTrend": "Need at least 2 records for a trend.",
    "analysis.low": "Low {value}",
    "analysis.high": "High {value}",
    "analysis.oldest": "Oldest {value}",
    "analysis.newest": "Newest {value}",
    "analysis.scoreTrend": "Score trend",
    "analysis.pointTitle.match": "Match {index}: {score} pts - {date}",
    "analysis.pointTitle.run": "Run {index}: {score} pts - {date}",
    "analysis.pointDetail.match": "Match {index} · {date} · {result} {ourScore}–{opponentScore} · {auton}",
    "analysis.pointDetail.run": "{type} run {index} · {date} · {score} points",
    "analysis.openCorrelation": "Open Correlation Lab",
    "analysis.correlationTool": "Advanced comparison tool",
    "analysis.compare": "Compare",
    "analysis.against": "Against",
    "analysis.correlationResult": "r = {r} from {count} saved {type}",
    "analysis.correlationHelp": "Positive means the two numbers rise together. Negative means one tends to rise when the other falls.",
    "analysis.correlation.notEnough": "Not enough variation yet",
    "analysis.correlation.strongPositive": "Strong positive",
    "analysis.correlation.moderatePositive": "Moderate positive",
    "analysis.correlation.weakPositive": "Weak positive",
    "analysis.correlation.strongNegative": "Strong negative",
    "analysis.correlation.moderateNegative": "Moderate negative",
    "analysis.correlation.weakNegative": "Weak negative",
    "analysis.correlation.little": "Little relationship",
    "analysis.driverAvg": "Driver avg",
    "analysis.autonAvg": "Auton avg",
    "analysis.bestDriver": "Best Driver",
    "analysis.bestAuton": "Best Auton",
    "analysis.bestCombined": "Best combined",
    "analysis.skillsSplit": "Skills split",
    "analysis.skillsSplitDetail": "Driver plus Autonomous",
    "analysis.skillsQuestion": "How do Driver and Autonomous compare?",
    "analysis.skillsQuestionDetail": "Best combined means best Driver plus best Autonomous.",
    "analysis.headQuestion": "Why are we winning or losing?",
    "analysis.headQuestionDetail": "These cards explain the main scoring levers behind the record.",
    "analysis.skillsSourceQuestion": "Where is the Skills score coming from?",
    "analysis.skillsSourceDetail": "Driver and Autonomous are tracked separately, with yellow/control mistakes called out.",
    "analysis.working": "What is working",
    "analysis.costing": "What is costing points",
    "analysis.focus": "What to focus on next",
    "analysis.story.recommendedFocus": "Recommended focus",
    "analysis.story.why": "Why",
    "analysis.story.proof": "Proof",
    "analysis.story.nextTarget": "Do this next",
    "analysis.story.theStoryNow": "Coach read",
    "analysis.story.matchPhases": "Match phases",
    "analysis.story.openingPhase": "Opening phase",
    "analysis.story.controlPhase": "Control phase",
    "analysis.story.finishPhase": "Finish phase",
    "analysis.story.routeStart": "Route start",
    "analysis.story.routeControl": "Route control",
    "analysis.story.routeCeiling": "Route ceiling",
    "analysis.story.openingHeadDetail": "Auton record: {autonWins}W / {autonTies}T / {autonLosses}L. Average auton points: {points}.",
    "analysis.story.controlHeadDetail": "Center control: {center}. Yellow conversion: {yellows}. Red/blue pins: {pins}.",
    "analysis.story.finishHeadDetail": "Average margin: {margin}. Estimated missed points: {missed}.",
    "analysis.story.routeStartDetail": "Driver avg {driver}. Autonomous avg {auton}.",
    "analysis.story.routeControlDetail": "Center active {center}. Yellow conversion {yellows}.",
    "analysis.story.strategyMap": "Strategy map",
    "analysis.story.strategyMapHead": "Where the match is tilting",
    "analysis.story.strategyMapDetail": "Green is holding. Red is the next leak to attack.",
    "analysis.story.strategyMapSkills": "Where the route is leaking value",
    "analysis.story.strategyMapSkillsDetail": "Use this to spot the weakest route segment fast.",
    "analysis.story.mapAuton": "Auton",
    "analysis.story.mapCenter": "Center",
    "analysis.story.mapYellows": "Yellows",
    "analysis.story.mapPins": "Pins",
    "analysis.story.mapMargin": "Margin",
    "analysis.story.mapDriver": "Driver",
    "analysis.story.turningPoint": "Turning point",
    "analysis.story.whatChanges": "What changes when we win",
    "analysis.story.nextChapter": "Next practice",
    "analysis.story.missionAuton": "Opening mission",
    "analysis.story.missionAutonDetail": "Raise auton to {value} or better in a 10-run drill.",
    "analysis.story.missionCenter": "Control mission",
    "analysis.story.missionCenterDetail": "Run final-20-second reps until center control is automatic.",
    "analysis.story.missionReview": "Review mission",
    "analysis.story.missionReviewDetail": "Save five clean records after the drill.",
    "analysis.story.missionDriver": "Driver mission",
    "analysis.story.missionDriverDetail": "Build one driver route that beats {value} repeatedly.",
    "analysis.story.missionSkillsAutonDetail": "Add one auton sequence that beats {value} repeatedly.",
    "analysis.story.whyWeThink": "Why we think that",
    "analysis.story.whyWeThinkDetail": "The three strongest signals from your saved data.",
    "analysis.story.numberProof": "Number proof",
    "analysis.story.numberProofDetail": "The quick proof behind the coach read.",
    "analysis.story.progressStory": "Season timeline",
    "analysis.story.filmRoom": "Film room",
    "analysis.story.timelineStrongUp": "Scores have improved significantly",
    "analysis.story.timelineUp": "Scores have steadily improved",
    "analysis.story.timelineRecovery": "Scores dipped, then recovered",
    "analysis.story.timelineDown": "Recent scores have declined",
    "analysis.story.timelineFlat": "Scores have remained consistent",
    "analysis.story.timelineUpDetail": "Recent results are stronger than the earliest results in this range.",
    "analysis.story.timelineDownDetail": "Recent results are below the earliest results in this range.",
    "analysis.story.timelineFlatDetail": "Recent and early results are performing at a similar level.",
    "analysis.story.recentSwing": "Recent swing",
    "analysis.story.strategyBreakdown": "Strategy breakdown",
    "analysis.story.strategyDetail": "Where the match is usually being won, lost, or left unfinished.",
    "analysis.story.averageLine": "Average {value}",
    "analysis.story.recentFive": "Recent 5 highlighted",
    "analysis.story.headSummary": "{count} saved matches. Average {score}. Win rate {rate}.",
    "analysis.story.skillsSummary": "{count} saved runs. Average {score}. Best combined {combined}.",
    "analysis.story.record": "Record",
    "analysis.story.recordDetail": "{rate} win rate in this range.",
    "analysis.story.needRecent": "Save five records in this range for a stronger recent-form read.",
    "analysis.story.progressDetail": "{value} versus the previous comparable range.",
    "analysis.story.rangeAverage": "Selected range average",
    "analysis.story.ceilingMarker": "Best saved result",
    "analysis.story.typicalMarker": "Typical saved result",
    "analysis.story.floorMarker": "Rough-round floor",
    "analysis.story.winLossDifference": "Win vs loss difference",
    "analysis.story.winsVsLosses": "Wins / losses",
    "analysis.story.winsLosses": "wins / losses",
    "analysis.story.winLossDetail": "The biggest difference between wins and losses.",
    "analysis.story.driverAutonValue": "Driver {driver} / Auton {auton}",
    "analysis.story.head.auton.title": "Make autonomous reliable first",
    "analysis.story.head.auton.why": "The first swing is unstable, so good matches start with extra pressure.",
    "analysis.story.head.auton.proof": "Auton win rate: {rate}. Average margin: {margin}.",
    "analysis.story.head.auton.target": "Run a repeatable auton that wins or ties before adding risk.",
    "analysis.story.head.center.title": "Finish with center control",
    "analysis.story.head.center.why": "Too many points are decided around the center late.",
    "analysis.story.head.center.proof": "Center control: {rate}. Missed points: {missed}.",
    "analysis.story.head.center.target": "Practice final 20 seconds around center positioning.",
    "analysis.story.head.yellow.title": "Score the yellows you already place",
    "analysis.story.head.yellow.why": "You are placing yellows that do not always become points.",
    "analysis.story.head.yellow.proof": "{scored}/{placed} yellows counted. Conversion: {rate}.",
    "analysis.story.head.yellow.target": "Call toggle ownership before placing extra yellows.",
    "analysis.story.head.floor.title": "Raise the bad-match floor",
    "analysis.story.head.floor.why": "The best matches are fine; the bad matches are too expensive.",
    "analysis.story.head.floor.proof": "Average: {average}. Bad-day floor: {floor}.",
    "analysis.story.head.floor.target": "Build a low-risk scoring plan for messy matches.",
    "analysis.story.head.margin.title": "Create more separation",
    "analysis.story.head.margin.why": "Wins are not separated enough from losses yet.",
    "analysis.story.head.margin.proof": "Win rate: {rate}. Average margin: {margin}.",
    "analysis.story.head.margin.target": "Practice the two fastest swings that add margin.",
    "analysis.story.head.ceiling.title": "Turn the best-match pattern into the normal pattern",
    "analysis.story.head.ceiling.why": "The pattern is there. Now make it boringly repeatable.",
    "analysis.story.head.ceiling.proof": "Average: {average}. Red/blue pins: {pins}.",
    "analysis.story.head.ceiling.target": "Replay the best-match blueprint until it becomes routine.",
    "analysis.story.skills.balance.title": "Save both Driver and Autonomous routes",
    "analysis.story.skills.balance.why": "The combined ceiling is only visible when both route types are represented.",
    "analysis.story.skills.balance.proof": "Driver runs: {driver}. Autonomous runs: {auton}.",
    "analysis.story.skills.balance.target": "Log paired Driver and Autonomous attempts in the same practice.",
    "analysis.story.skills.driver.title": "Stabilize the Driver route",
    "analysis.story.skills.driver.why": "Autonomous is outpacing Driver, so repeatable driver scoring is the fastest ceiling gain.",
    "analysis.story.skills.driver.proof": "Driver averages {driver}; Autonomous averages {auton}.",
    "analysis.story.skills.driver.target": "Practice one safer driver route before chasing max pins.",
    "analysis.story.skills.auton.title": "Build the Autonomous route",
    "analysis.story.skills.auton.why": "Driver is carrying the score, so autonomous improvement directly raises combined Skills.",
    "analysis.story.skills.auton.proof": "Driver averages {driver}; Autonomous averages {auton}.",
    "analysis.story.skills.auton.target": "Add one reliable autonomous scoring sequence.",
    "analysis.story.skills.yellow.title": "Convert more yellow pins",
    "analysis.story.skills.yellow.why": "Yellow points are being placed but not always made legal by ownership/control.",
    "analysis.story.skills.yellow.proof": "{scored} of {placed} yellows scored, a {rate} conversion rate.",
    "analysis.story.skills.yellow.target": "Practice toggle states before adding more yellows.",
    "analysis.story.skills.center.title": "Make center control automatic",
    "analysis.story.skills.center.why": "Center control protects yellow value and keeps the route from leaking points.",
    "analysis.story.skills.center.proof": "Center toggle is active in {rate} of saved runs.",
    "analysis.story.skills.center.target": "Add a consistent center-control checkpoint to the route.",
    "analysis.story.skills.ceiling.title": "Push the combined ceiling",
    "analysis.story.skills.ceiling.why": "The route base is healthy, so improvement should come from refining the highest-value sequence.",
    "analysis.story.skills.ceiling.proof": "Best combined is {combined}; recent form is {recent}.",
    "analysis.story.skills.ceiling.target": "Pick one route segment and chase cleaner execution.",
    "analysis.replay.kicker": "Performance story",
    "analysis.replay.title": "Season Replay",
    "analysis.replay.modeAria": "Replay type",
    "analysis.replay.period": "Selected period",
    "analysis.replay.confidence": "Story confidence",
    "analysis.replay.confidenceEarly": "Early read",
    "analysis.replay.confidenceDeveloping": "Developing signal",
    "analysis.replay.confidenceStrong": "Strong signal",
    "analysis.replay.intro": "Here is what your practice data shows.",
    "analysis.replay.shapeImproving": "Scores have steadily improved.",
    "analysis.replay.shapeRecovery": "Scores dipped in the middle of the season, then recovered.",
    "analysis.replay.shapeSteady": "Scores have remained consistent.",
    "analysis.replay.shapeDecline": "Recent scores have declined.",
    "analysis.replay.chapterTrajectory": "Trajectory",
    "analysis.replay.chapterTurning": "Turning Point",
    "analysis.replay.chapterAnatomy": "Match Breakdown",
    "analysis.replay.chapterSkillsAnatomy": "Run Breakdown",
    "analysis.replay.chapterPractice": "Practice Plan",
    "analysis.replay.trajectoryDetail": "Follow every exact result and the five-record trend over time.",
    "analysis.replay.trajectoryMarginDetail": "Each dot is one match. The line begins at match 10 and follows complete 10-match averages.",
    "analysis.replay.metricAria": "Head-on-head trajectory metric",
    "analysis.replay.metricScore": "Alliance score",
    "analysis.replay.metricMargin": "Match margin",
    "analysis.replay.legendDots": "Dots: your alliance's final score",
    "analysis.replay.legendMarginDots": "Dots: final match margin",
    "analysis.replay.legendSkillsDots": "Dots: saved Skills scores",
    "analysis.replay.legendTrend": "Gray line: exact results",
    "analysis.replay.legendRolling": "Cyan line: 5-record average",
    "analysis.replay.legendMarginRolling": "Cyan line: 10-match average margin",
    "analysis.replay.legendRecent": "Bracket: latest {count}",
    "analysis.replay.axisHeadX": "Practice match number",
    "analysis.replay.axisHeadY": "Our alliance final score (points)",
    "analysis.replay.axisHeadMarginY": "Match margin (points)",
    "analysis.replay.axisSkillsX": "Practice run number",
    "analysis.replay.axisSkillsY": "Skills run score (points)",
    "analysis.replay.latestBracket": "Latest {count}",
    "analysis.replay.firstTenAverage": "First 10 avg {value}",
    "analysis.replay.latestTenAverage": "Latest 10 avg {value}",
    "analysis.replay.marginImprovement": "Margin improvement {value} points",
    "analysis.replay.startingLevel": "Starting level",
    "analysis.replay.currentLevel": "Current level",
    "analysis.replay.biggestTurn": "Biggest turn",
    "analysis.replay.turningDetail": "This is the most important repeatable difference in the selected data.",
    "analysis.replay.whenWorking": "When it works",
    "analysis.replay.whenMissing": "When it slips",
    "analysis.replay.averageScoreShort": "average score",
    "analysis.replay.pointSwing": "{value}-point swing",
    "analysis.replay.anatomyDetail": "One verdict for every phase. The weakest phase becomes the first practice mission.",
    "analysis.replay.practiceDetail": "Three missions, in order. Finish the first target before adding complexity.",
    "analysis.replay.whyItMatters": "Why it matters",
    "analysis.replay.successTarget": "Success target",
    "analysis.replay.evidenceTitle": "Explore the Evidence",
    "analysis.replay.evidenceDetail": "Open the numbers, comparisons, and correlation tools behind this replay.",
    "analysis.replay.numberProof": "Number proof",
    "analysis.replay.winLossProof": "What changes between wins and losses",
    "analysis.replay.skillsProof": "Driver and Autonomous proof",
    "analysis.replay.noDataTitle": "The replay needs saved data",
    "analysis.replay.noHeadData": "Save head-on-head matches to build your performance story.",
    "analysis.replay.noSkillsData": "Save Driver and Autonomous Skills runs to build your route story.",
    "analysis.replay.pointHint": "Hover or focus a point to read that record.",
    "analysis.replay.dateTurn": "{date}, a {value}-point change",
    "analysis.replay.missionHeadAutonWhy": "A repeatable opening removes the first pressure point from every match.",
    "analysis.replay.missionHeadCenterWhy": "Center control protects robot points and legal yellow scoring late.",
    "analysis.replay.missionHeadYellowWhy": "Placed yellows only matter when ownership makes them score.",
    "analysis.replay.missionHeadFloorWhy": "A safer minimum plan keeps one rough sequence from deciding the match.",
    "analysis.replay.missionHeadReviewWhy": "Fresh saved matches prove whether the practice change survives real play.",
    "analysis.replay.missionSkillsDriverWhy": "A stable Driver route turns peak scores into repeatable scores.",
    "analysis.replay.missionSkillsAutonWhy": "Autonomous improvement adds directly to the combined Skills ceiling.",
    "analysis.replay.missionSkillsYellowWhy": "Clean ownership converts the pins already in the route into real points.",
    "analysis.replay.missionSkillsCenterWhy": "A reliable center checkpoint prevents late route value from disappearing.",
    "analysis.replay.missionSkillsReviewWhy": "Paired runs show whether Driver and Autonomous are improving together.",
    "scouting.skillsKicker": "Official Skills standings",
    "judge.notice": "Prepared sample data for 4330P RoboPigeons is loaded to save review time.",
    "judge.identityKicker": "Recognized team",
    "judge.identitySource": "Team details verified from synced VEX event data",
    "judge.robot": "Robot",
    "judge.organization": "Organization",
    "judge.location": "Location",
    "judge.officialSkills": "Official Override Skills",
    "judge.officialSkillsPending": "No official Override Skills score has been posted for 4330P yet.",
    "judge.officialSkillsFound": "Official Override Skills results for 4330P are shown below.",
    "scouting.teamSkillsTitle": "Team Skills Search",
    "scouting.teamSkillsDescription": "Search teams from the public VEX V5RC Override Skills standings.",
    "scouting.teamSearch": "Team search",
    "scouting.teamSearchPlaceholder": "Team number, name, city, region, or event code",
    "scouting.searchTeams": "Search Teams",
    "scouting.teamSkillsInitial": "Search official season Skills results by team number, team name, or region.",
    "scouting.dataKicker": "Official data import",
    "scouting.competitionData": "Competition Data",
    "scouting.competitionDescription": "Search synced VEX event data, import teams, and cache official details for later analysis.",
    "scouting.findCompetition": "Find competition",
    "scouting.findPlaceholder": "Ransom, Miami, 65030, Florida, 4330P...",
    "scouting.region": "Region",
    "scouting.allSyncedRegions": "All synced regions",
    "scouting.showEvents": "Show Events",
    "scouting.loadingCompetitions": "Loading synced competitions...",
    "scouting.importedCompetition": "Imported competition",
    "scouting.syncedLocal": "Synced local data",
    "scouting.noSyncedData": "No synced data",
    "scouting.liveProxy": "Live proxy connected",
    "scouting.noProxy": "Proxy not connected",
    "scouting.searchingSkills": "Searching public VEX Skills standings...",
    "scouting.foundTeams.one": "Found {count} matching team.",
    "scouting.foundTeams.many": "Found {count} matching teams.",
    "scouting.noTeams": "No matching teams found.",
    "scouting.noTeamsLong": "No matching teams found in the public Skills standings.",
    "scouting.typeTwo": "Type at least 2 characters to search teams.",
    "scouting.skillsError": "Team Skills data could not load. Try again later.",
    "scouting.dataError": "Competition data could not load. Try again later.",
    "scouting.proxyNeeded": "Live VEX data needs the proxy before it can load official results.",
    "scouting.noSynced": "No synced competitions found yet. Run the VEX collector and import a bundle.",
    "scouting.searchingCompetitions": "Searching synced competitions...",
    "scouting.noCompetitionMatches": "No matching competitions found.",
    "scouting.foundCompetitions.one": "Found {count} synced competition.",
    "scouting.foundCompetitions.many": "Found {count} synced competitions.",
    "scouting.foundAcross.one": "Found {count} synced competitions across {regions} matching region.",
    "scouting.foundAcross.many": "Found {count} synced competitions across {regions} matching regions.",
    "scouting.noRegionMatch": "No synced regions match \"{query}\".",
    "scouting.loaded.one": "{count} synced competition loaded.{updated}",
    "scouting.loaded.many": "{count} synced competitions loaded.{updated}",
    "scouting.lastUpdated": " Last updated {date}.",
    "scouting.myCompetitions": "My competitions",
    "scouting.enterTeam": "Enter a team number during setup to auto-detect your events.",
    "scouting.noMyEvents": "No synced competitions found for {team}.",
    "scouting.tryAll": "Try searching all synced events below.",
    "scouting.myEvents.one": "{count} synced event found for {team}",
    "scouting.myEvents.many": "{count} synced events found for {team}",
    "scouting.event": "Event",
    "scouting.unnamedEvent": "Unnamed event",
    "scouting.count.teams": "{count} teams",
    "scouting.count.skills": "{count} skills",
    "scouting.count.awards": "{count} awards",
    "scouting.viewImport": "View / Import",
    "scouting.regionNotListed": "Region not listed",
    "scouting.dateNotListed": "Date not listed",
    "scouting.allMatchingRegions": "All matching regions for \"{query}\"",
    "scouting.allMatchingMeta": "{regions} synced regions - {events} events",
    "scouting.showEveryEvent": "Show every imported event",
    "scouting.syncedEvents.one": "{count} synced event",
    "scouting.syncedEvents.many": "{count} synced events",
    "scouting.teams": "Teams",
    "scouting.teamsHint": "Click a team for season Skills and event details.",
    "scouting.noRegisteredTeams": "No registered teams are listed yet.",
    "scouting.awards": "Awards",
    "scouting.awardsSynced.one": "{count} award synced for this event.",
    "scouting.awardsSynced.many": "{count} awards synced for this event.",
    "scouting.noAwards": "No awards posted yet.",
    "scouting.winnerNotListed": "Winner not listed",
    "filters.all": "All",
    "filters.mine": "My competitions",
    "filters.usa": "United States",
    "filters.upcoming": "Upcoming",
    "filters.past": "Past",
    "toast.enterTeam": "Enter your team number first.",
    "toast.matchDeleted": "Match deleted.",
    "toast.confirmDelete": "Press Confirm Delete to remove this match.",
    "toast.matchesCleared": "Saved matches cleared.",
    "toast.localWiped": "Local app data wiped.",
    "toast.invalidJson": "Invalid JSON. Match was not changed.",
    "toast.editNeedsId": "Edited match needs an id.",
    "toast.matchUpdated": "Match updated.",
    "toast.competitionImported": "Competition data imported.",
    "toast.sampleRebuilt": "Sample dev data rebuilt.",
    "toast.chooseAlliance": "Choose your alliance color before saving.",
    "toast.chooseSkillsType": "Choose Driver or Autonomous before saving.",
    "toast.matchSaveFailed": "Match could not be saved on this device.",
    "toast.matchSaved": "Match saved on this device.",
    "toast.skillsSaveFailed": "Skills run could not be saved on this device.",
    "toast.skillsSaved": "Skills run saved on this device.",
    "toast.teamNameSaved": "{teamNumber} {teamName} saved on this device.",
    "toast.teamSaved": "Team {teamNumber} saved on this device.",
    "setup.confirmIdentity": "Are you {teamNumber} {teamName}?",
    "setup.checkAnother": "Check Another Team",
    "aria.decreasePins": "Decrease {color} pins in {quadrant} quadrant",
    "aria.increasePins": "Increase {color} pins in {quadrant} quadrant",
    "aria.pinsInQuadrant": "{color} pins in {quadrant} quadrant",
    "scouting.date": "Date",
    "scouting.rank": "Rank #{rank}",
    "scouting.officialSkillsResult": "Official Skills result",
    "scouting.noExtraTeamDetails": "No extra team details listed.",
    "scouting.eventWithId": "Event {id}",
    "scouting.syncedDataCounts": "Synced data counts",
    "scouting.teamDetails": "Team details",
    "scouting.seasonSkills": "Season Skills",
    "scouting.eventSkills": "Event Skills",
    "scouting.robot": "Robot",
    "scouting.noAdditionalTeamDetails": "No additional team details listed.",
    "scouting.attempts": "{count} attempts",
    "scouting.award": "Award",
    "scouting.loadedDetail": "Loaded {date}. {skills} skills rows - {awards} awards.",
    "scouting.onlyImportedRegions": "Only imported season-204 regions appear here.",
    "analysis.matchesLabel": "matches",
    "analysis.runsLabel": "runs",
    "analysis.recentDetail": "last {count}, {delta} vs range avg",
    "analysis.recordDetail": "{wins}W {losses}L {ties}T",
    "analysis.winFactors": "What usually helps us win",
    "analysis.winFactorsEmpty": "Save more varied matches to identify what is most tied to winning.",
    "analysis.winFactorsDetail": "The strongest simple relationships with winning in this range.",
    "analysis.learning": "Learning",
    "analysis.topCount": "Top {count}",
    "analysis.missedPoints": "Missed points",
    "analysis.missedPointsDetail": "Estimated points left from unowned yellows, lost or tied auton, and missing midfield robots/control.",
    "analysis.avgValue": "{value} avg",
    "analysis.autonReliability": "Auton reliability",
    "analysis.percentWon": "{value} won",
    "analysis.autonReliabilityDetail": "Auton outcome compared with final margin.",
    "analysis.wonAuton": "Won auton",
    "analysis.tiedAuton": "Tied auton",
    "analysis.lostAuton": "Lost auton",
    "analysis.avgMargin": "avg margin {value}",
    "analysis.centerImpact": "Center control impact",
    "analysis.centerImpactDetail": "Avg margin with center: {withCenter}. Without center: {withoutCenter}.",
    "analysis.swing": "{value} swing",
    "analysis.yellowEfficiency": "Toggle/yellows efficiency",
    "analysis.yellowEfficiencyDetail": "{scored} of {placed} yellow pins counted for your alliance in this range.",
    "analysis.floorCeilingDetail": "A realistic low/high range using saved-score percentiles, less jumpy than raw worst and best.",
    "analysis.previousAverage": "Previous comparable range averaged {value}.",
    "analysis.needEarlierData": "Need earlier saved data for a previous-range comparison.",
    "analysis.bestBlueprint": "Best match blueprint",
    "analysis.bestBlueprintDetail": "Your best 3 averaged {pins} red/blue pins and {yellows} owned yellows. Center was controlled {center}/3 times; auton won {auton}/3.",
    "analysis.badGoodRange": "Bad day / good day range",
    "analysis.weeklyProgress": "Weekly progress",
    "analysis.yellowConversion": "Yellow conversion",
    "analysis.yellowConversionDetail": "{scored} of {placed} yellow pins scored under the Skills ownership rules.",
    "analysis.skillsRouteProgress": "Skills route progress",
    "analysis.skillsRouteProgressDetail": "Compares newer runs against older runs separately for Driver and Autonomous.",
    "analysis.driverTrend": "Driver trend",
    "analysis.autonTrend": "Autonomous trend",
    "analysis.checkDetails": "Check details",
    "analysis.nextPractice": "Next practice",
    "analysis.routeBase": "Route base",
    "analysis.missedCount": "{count} missed",
    "analysis.correlationGroup.score": "Score",
    "analysis.correlationGroup.pins": "Pins",
    "analysis.correlationGroup.zones": "Zones",
    "analysis.correlationGroup.control": "Control",
    "analysis.correlationGroup.autonomous": "Autonomous",
    "analysis.correlationOption.ourScore": "Our score",
    "analysis.correlationOption.opponentScore": "Opponent score",
    "analysis.correlationOption.margin": "Score margin",
    "analysis.correlationOption.totalMatchScore": "Total match score",
    "analysis.correlationOption.win": "Win result",
    "analysis.correlationOption.alliancePins": "Our red/blue pins",
    "analysis.correlationOption.opponentPins": "Opponent red/blue pins",
    "analysis.correlationOption.totalRedBluePins": "Total red + blue pins",
    "analysis.correlationOption.totalPins": "Total pins placed",
    "analysis.correlationOption.ownedYellow": "Our owned yellow pins",
    "analysis.correlationOption.opponentOwnedYellow": "Opponent owned yellow pins",
    "analysis.correlationOption.yellowPins": "Yellow pins placed",
    "analysis.correlationOption.ourOuterToggles": "Our outer toggles owned",
    "analysis.correlationOption.opponentOuterToggles": "Opponent outer toggles owned",
    "analysis.correlationOption.centerControl": "Center controlled by us",
    "analysis.correlationOption.midfieldRobots": "Our midfield robots",
    "analysis.correlationOption.opponentMidfieldRobots": "Opponent midfield robots",
    "analysis.correlationOption.autonPoints": "Auton points",
    "analysis.correlationOption.autonWon": "Won auton",
    "analysis.correlationOption.autonLost": "Lost auton",
    "analysis.correlationOption.autonTied": "Tied auton",
    "analysis.correlationOption.score": "Skills score",
    "analysis.correlationOption.driverRun": "Driver run",
    "analysis.correlationOption.autonRun": "Autonomous run",
    "analysis.correlationOption.redBluePins": "Total red + blue pins",
    "analysis.correlationOption.redPins": "Red pins scored",
    "analysis.correlationOption.bluePins": "Blue pins scored",
    "analysis.correlationOption.scoredYellow": "Yellow pins scored",
    "analysis.correlationOption.midfield": "Center toggle active",
    "analysis.correlationOption.correctYellowOwnership": "Correct yellow ownership count",
    "analysis.correlationOption.missedYellowPins": "Missed yellow pins",
    "analysis.zoneOption.TotalPins": "{quadrant} zone total pins",
    "analysis.zoneOption.OurPins": "Our pins in {quadrant}",
    "analysis.zoneOption.OpponentPins": "Opponent pins in {quadrant}",
    "analysis.zoneOption.OwnedYellow": "Owned yellow pins in {quadrant}",
    "analysis.zoneOption.Pins": "{quadrant} zone pins",
    "analysis.headWorkingRecent": "Your last {count} matches are running {delta} points above this range.",
    "analysis.headWorkingWinRate": "You are winning {rate} of matches in this range.",
    "analysis.headWorkingBaseline": "Your current baseline is {average} points. That is the number to push up.",
    "analysis.headCostingYellows": "Yellow ownership is the biggest visible leak: {scored} of {placed} yellows counted.",
    "analysis.headCostingAuton": "Autonomous is not reliable yet: {rate} won in this range.",
    "analysis.headCostingMissed": "Missed-point estimate averages {missed} points per match.",
    "analysis.headFocusCenter": "Prioritize ending with midfield control more often; it connects directly to robot points and center yellows.",
    "analysis.headFocusYellows": "Clean up toggle ownership before placing extra yellow pins.",
    "analysis.headFocusBlueprint": "Keep building around your best-match pattern and raise the floor on rough rounds.",
    "analysis.headNoteUp": "Your recent matches are trending up by {delta} points against this range average. Keep the gains, then hunt the {missed} estimated missed points.",
    "analysis.headNoteDown": "Your last {count} matches are below the range average. Start with the repeatable points: auton, center control, and yellows that actually count.",
    "analysis.headNoteSteady": "Your performance is steady around {average} points. The fastest improvement is turning missed yellow/control points into guaranteed points.",
    "analysis.skillsWorkingRecent": "Your last {count} Skills runs are {delta} points above this range.",
    "analysis.skillsWorkingCombined": "Best combined is {combined}: Driver {driver} plus Autonomous {auton}.",
    "analysis.skillsCostingYellows": "{missed} of {placed} yellow pins did not score because the needed ownership condition was missing.",
    "analysis.skillsCostingNoYellows": "Save runs with yellow pins and toggle states to find the main scoring leak.",
    "analysis.skillsFocusAuton": "Use Driver as the stable base, then raise Autonomous until the combined score jumps.",
    "analysis.skillsFocusDriver": "Autonomous is carrying well; now make Driver runs more repeatable.",
    "analysis.skillsNoteSplit": "Your Skills average is {average}. Driver is averaging {driver} and Autonomous is averaging {auton}, so the next gain is whichever route is less repeatable.",
    "analysis.skillsNoteOneType": "Your Skills average is {average}. Save both Driver and Autonomous runs to see the real combined ceiling."
  },
  es: {},
  "zh-CN": {}
};
Object.assign(translations.es, {
  "aria.appOverview": "Resumen de la app",
  "aria.savedSummary": "Resumen de partidos guardados",
  "aria.scoringMode": "Modo de puntuación",
  "aria.skillsPanel": "Análisis y marcador de Skills",
  "aria.skillsReset": "Reinicio de Skills",
  "aria.skillsScore": "Puntuación de Skills",
  "aria.skillsRunType": "Tipo de intento de Skills",
  "aria.resetScorer": "Reiniciar marcador",
  "aria.liveScore": "Puntuación en vivo",
  "aria.closeSaveMatch": "Cerrar diálogo de guardar partido",
  "aria.closeSkillsSave": "Cerrar diálogo de guardar Skills",
  "aria.closeDevEdit": "Cerrar diálogo de edición de desarrollo",
  "brand.title": "Analizador de Puntuación Override",
  "brand.credit": "Hecho por - 4330P RoboPigeons",
  "banner.team": "Equipo",
  "banner.matches": "Partidos",
  "banner.record": "Récord",
  "judge.practiceMatches": "Partidos de práctica",
  "judge.practiceRecord": "Récord de práctica",
  "language.label": "Idioma",
  "language.aria": "Idioma",
  "tabs.head": "Frente a frente",
  "tabs.skills": "Skills",
  "tabs.scouting": "Scouting",
  "tabs.analysis": "Análisis",
  "range.today": "Hoy",
  "range.7": "7 días",
  "range.30": "30 días",
  "range.all": "Todo",
  "range.custom": "Personalizado",
  "range.start": "Inicio",
  "range.end": "Fin",
  "common.optional": "Opcional",
  "common.notListed": "No listado",
  "common.notLoaded": "No cargado",
  "common.notSaved": "No guardado",
  "common.notEntered": "No ingresado",
  "common.cancel": "Cancelar",
  "common.team": "Equipo",
  "color.red": "Rojo",
  "color.blue": "Azul",
  "color.yellow": "Amarillo",
  "color.neutral": "Neutral",
  "quadrant.top": "superior",
  "quadrant.right": "derecha",
  "quadrant.bottom": "inferior",
  "quadrant.left": "izquierda",
  "quadrant.center": "centro",
  "match.saveMatch": "Guardar partido",
  "match.redAuton": "Autónomo rojo",
  "match.blueAuton": "Autónomo azul",
  "skills.score": "Puntuación Skills",
  "skills.driver": "Driver",
  "skills.autonomous": "Autónomo",
  "skills.saveRun": "Guardar intento",
  "history.matchTitle": "Historial de partidos",
  "history.matchDescription": "Partidos guardados recientemente en este dispositivo.",
  "history.matchEmpty": "Los partidos guardados aparecerán aquí después de puntuar y guardar uno.",
  "history.skillsTitle": "Historial de Skills",
  "history.skillsDescription": "Intentos de Skills guardados recientemente en este dispositivo.",
  "history.skillsEmpty": "Los intentos de Skills guardados aparecerán aquí después de puntuar y guardar uno.",
  "history.showMore": "Mostrar más",
  "history.showLess": "Mostrar menos",
  "history.confirmDelete": "Confirmar eliminación",
  "history.deleteMatch": "Eliminar partido",
  "history.savedMatch": "Partido guardado",
  "history.result.saved": "guardado",
  "history.result.win": "victoria",
  "history.result.loss": "derrota",
  "history.result.tie": "empate",
  "history.team": "Equipo",
  "history.alliance": "Alianza",
  "history.ourScore": "Nuestra puntuación",
  "history.opponentScore": "Puntuación rival",
  "history.partner": "Compañero",
  "history.opponentOne": "Rival 1",
  "history.opponentTwo": "Rival 2",
  "history.runType": "Tipo de intento",
  "history.notes": "Notas",
  "setup.title": "Configurar equipo",
  "setup.description": "Ingresa tu número de equipo una vez. Esta app lo recordará en este dispositivo.",
  "setup.teamNumber": "Tu número de equipo",
  "setup.checkTeam": "Buscar equipo",
  "setup.checking": "Buscando...",
  "setup.teamFound": "Equipo encontrado",
  "setup.yesContinue": "Sí, continuar",
  "setup.noEdit": "No, editar número",
  "saveMatch.title": "Guardar partido",
  "saveMatch.description": "Todos los detalles son opcionales. La puntuación y el campo completo se guardan automáticamente.",
  "saveMatch.partnerTeam": "Número del compañero de alianza",
  "saveMatch.partnerNotes": "Notas del compañero",
  "saveMatch.opponentOne": "Número/nombre del rival 1",
  "saveMatch.opponentOneNotes": "Notas del rival 1",
  "saveMatch.opponentTwo": "Número/nombre del rival 2",
  "saveMatch.opponentTwoNotes": "Notas del rival 2",
  "saveMatch.skip": "Omitir detalles",
  "saveSkills.title": "Guardar intento de Skills",
  "saveSkills.description": "Las notas son opcionales. La puntuación y el campo de Skills completo se guardan automáticamente.",
  "saveSkills.notes": "Notas del intento",
  "saveSkills.skip": "Omitir notas",
  "dev.title": "Modo dev",
  "dev.description": "Edita registros guardados o borra datos locales de prueba en este dispositivo.",
  "dev.autofill": "Autocompletar datos de muestra",
  "dev.clearMatches": "Borrar partidos",
  "dev.wipeAll": "Borrar todos los datos",
  "dev.generatedScenario": "Escenario generado",
  "dev.coachSelected": "Selección del coach",
  "dev.seasonShape": "Forma de la temporada",
  "dev.selectorMismatch": "El generador no coincide",
  "dev.editTitle": "Editar partido guardado",
  "dev.editDescription": "Modo dev: edita directamente el JSON guardado. El JSON inválido no se guardará.",
  "dev.saveChanges": "Guardar cambios",
  "dev.tools": "Herramientas dev",
  "dev.editJson": "Editar JSON",
  "analysis.kicker": "Rendimiento local",
  "analysis.title": "Mi rendimiento",
  "analysis.description": "Tendencias de puntuación de partidos e intentos de Skills guardados en este dispositivo.",
  "analysis.rangeAria": "Rango de fechas del análisis",
  "analysis.head.emptySummary": "Guarda partidos para desbloquear el análisis frente a frente.",
  "analysis.skills.emptySummary": "Guarda intentos de Skills para desbloquear el análisis.",
  "analysis.head.emptyPanel": "Guarda partidos frente a frente para desbloquear este panel.",
  "analysis.skills.emptyPanel": "Guarda intentos de Skills para desbloquear este panel.",
  "analysis.noRange": "No hay datos guardados en este rango.",
  "analysis.matches.one": "{count} partido",
  "analysis.matches.many": "{count} partidos",
  "analysis.runs.one": "{count} intento",
  "analysis.runs.many": "{count} intentos",
  "analysis.summaryAverage": "Promedio de {score} puntos en este rango.",
  "analysis.coachNote": "Nota de coach",
  "analysis.averageScore": "Puntuación media",
  "analysis.winRate": "Porcentaje de victorias",
  "analysis.best": "Mejor",
  "analysis.median": "Mediana",
  "analysis.worst": "Peor",
  "analysis.last5": "Últimos 5 vs promedio",
  "analysis.trendTitle": "¿Estamos mejorando?",
  "analysis.trendDetail.match": "Cada punto es un partido guardado, de más antiguo a más reciente.",
  "analysis.trendDetail.run": "Cada punto es un intento guardado, de más antiguo a más reciente.",
  "analysis.needTrend": "Se necesitan al menos 2 registros para ver una tendencia.",
  "analysis.low": "Bajo {value}",
  "analysis.high": "Alto {value}",
  "analysis.oldest": "Más antiguo {value}",
  "analysis.newest": "Más reciente {value}",
  "analysis.scoreTrend": "Tendencia de puntuación",
  "analysis.pointTitle.match": "Partido {index}: {score} pts - {date}",
  "analysis.pointTitle.run": "Intento {index}: {score} pts - {date}",
  "analysis.pointDetail.match": "Partido {index} · {date} · {result} {ourScore}–{opponentScore} · {auton}",
  "analysis.pointDetail.run": "Intento {index} de {type} · {date} · {score} puntos",
  "analysis.openCorrelation": "Abrir laboratorio de correlación",
  "analysis.correlationTool": "Herramienta avanzada de comparación",
  "analysis.compare": "Comparar",
  "analysis.against": "Con",
  "analysis.correlationResult": "r = {r} con {count} {type} guardados",
  "analysis.correlationHelp": "Positivo significa que ambos números suben juntos. Negativo significa que uno suele subir cuando el otro baja.",
  "analysis.correlation.notEnough": "Todavía no hay suficiente variación",
  "analysis.correlation.strongPositive": "Positiva fuerte",
  "analysis.correlation.moderatePositive": "Positiva moderada",
  "analysis.correlation.weakPositive": "Positiva débil",
  "analysis.correlation.strongNegative": "Negativa fuerte",
  "analysis.correlation.moderateNegative": "Negativa moderada",
  "analysis.correlation.weakNegative": "Negativa débil",
  "analysis.correlation.little": "Poca relación",
  "analysis.driverAvg": "Prom. Driver",
  "analysis.autonAvg": "Prom. Autónomo",
  "analysis.bestDriver": "Mejor Driver",
  "analysis.bestAuton": "Mejor Autónomo",
  "analysis.bestCombined": "Mejor combinado",
  "analysis.skillsSplit": "División de Skills",
  "analysis.skillsSplitDetail": "Driver más Autónomo",
  "analysis.skillsQuestion": "¿Cómo se comparan Driver y Autónomo?",
  "analysis.skillsQuestionDetail": "Mejor combinado significa mejor Driver más mejor Autónomo.",
  "analysis.headQuestion": "¿Por qué ganamos o perdemos?",
  "analysis.headQuestionDetail": "Estas tarjetas explican las principales palancas de puntuación detrás del récord.",
  "analysis.skillsSourceQuestion": "¿De dónde viene la puntuación de Skills?",
  "analysis.skillsSourceDetail": "Driver y Autónomo se rastrean por separado, con errores de amarillos/control destacados.",
  "analysis.working": "Qué está funcionando",
  "analysis.costing": "Qué está costando puntos",
  "analysis.focus": "En qué enfocarse ahora",
  "analysis.story.recommendedFocus": "Enfoque recomendado",
  "analysis.story.why": "Por qué",
    "analysis.story.proof": "Prueba",
    "analysis.story.nextTarget": "Haz esto ahora",
    "analysis.story.theStoryNow": "Lectura del coach",
  "analysis.story.matchPhases": "Fases del partido",
  "analysis.story.openingPhase": "Apertura",
  "analysis.story.controlPhase": "Control",
  "analysis.story.finishPhase": "Cierre",
  "analysis.story.routeStart": "Inicio de ruta",
  "analysis.story.routeControl": "Control de ruta",
  "analysis.story.routeCeiling": "Techo de ruta",
  "analysis.story.openingHeadDetail": "Autónomo: {autonWins}V / {autonTies}E / {autonLosses}D. Puntos autónomos promedio: {points}.",
  "analysis.story.controlHeadDetail": "Control del centro: {center}. Conversión amarilla: {yellows}. Pines rojos/azules: {pins}.",
  "analysis.story.finishHeadDetail": "Margen promedio: {margin}. Puntos perdidos estimados: {missed}.",
  "analysis.story.routeStartDetail": "Promedio Driver {driver}. Promedio Autónomo {auton}.",
  "analysis.story.routeControlDetail": "Centro activo {center}. Conversión amarilla {yellows}.",
  "analysis.story.strategyMap": "Mapa estratégico",
  "analysis.story.strategyMapHead": "Hacia dónde se inclina el partido",
  "analysis.story.strategyMapDetail": "Verde aguanta. Rojo es la fuga que toca atacar.",
  "analysis.story.strategyMapSkills": "Dónde la ruta pierde valor",
  "analysis.story.strategyMapSkillsDetail": "Úsalo para encontrar rápido el tramo más débil de la ruta.",
  "analysis.story.mapAuton": "Autónomo",
  "analysis.story.mapCenter": "Centro",
  "analysis.story.mapYellows": "Amarillos",
  "analysis.story.mapPins": "Pines",
  "analysis.story.mapMargin": "Margen",
  "analysis.story.mapDriver": "Driver",
  "analysis.story.turningPoint": "Punto de giro",
  "analysis.story.whatChanges": "Qué cambia cuando ganamos",
  "analysis.story.nextChapter": "Próxima práctica",
  "analysis.story.missionAuton": "Misión de apertura",
  "analysis.story.missionAutonDetail": "Sube autónomo a {value} o más en una rutina de 10 intentos.",
  "analysis.story.missionCenter": "Misión de control",
  "analysis.story.missionCenterDetail": "Haz repeticiones de los últimos 20 segundos hasta controlar centro sin pensarlo.",
  "analysis.story.missionReview": "Misión de revisión",
  "analysis.story.missionReviewDetail": "Guarda cinco registros limpios después del ejercicio.",
  "analysis.story.missionDriver": "Misión Driver",
  "analysis.story.missionDriverDetail": "Crea una ruta Driver que supere {value} repetidamente.",
  "analysis.story.missionSkillsAutonDetail": "Agrega una secuencia autónoma que supere {value} repetidamente.",
  "analysis.story.whyWeThink": "Por qué pensamos eso",
  "analysis.story.whyWeThinkDetail": "Las tres señales más fuertes de tus datos guardados.",
  "analysis.story.numberProof": "Prueba numérica",
  "analysis.story.numberProofDetail": "La prueba rápida detrás de la lectura del coach.",
  "analysis.story.progressStory": "Línea de temporada",
  "analysis.story.filmRoom": "Sala de video",
  "analysis.story.timelineStrongUp": "Los puntajes han mejorado significativamente",
  "analysis.story.timelineUp": "Los puntajes han mejorado de forma constante",
  "analysis.story.timelineRecovery": "Los puntajes bajaron y luego se recuperaron",
  "analysis.story.timelineDown": "Los puntajes recientes han bajado",
  "analysis.story.timelineFlat": "Los puntajes se han mantenido constantes",
  "analysis.story.timelineUpDetail": "Los resultados recientes superan los primeros resultados de este período.",
  "analysis.story.timelineDownDetail": "Los resultados recientes están por debajo de los primeros resultados de este período.",
  "analysis.story.timelineFlatDetail": "Los resultados recientes y los primeros están en un nivel parecido.",
  "analysis.story.recentSwing": "Cambio reciente",
  "analysis.story.strategyBreakdown": "Desglose estratégico",
  "analysis.story.strategyDetail": "Dónde el partido suele ganarse, perderse o quedar incompleto.",
  "analysis.story.averageLine": "Promedio {value}",
  "analysis.story.recentFive": "Últimos 5 resaltados",
  "analysis.story.headSummary": "{count} partidos guardados. Promedio {score}. Victorias {rate}.",
  "analysis.story.skillsSummary": "{count} intentos guardados. Promedio {score}. Mejor combinado {combined}.",
  "analysis.story.record": "Récord",
  "analysis.story.recordDetail": "{rate} de victorias en este rango.",
  "analysis.story.needRecent": "Guarda cinco registros en este rango para leer mejor la forma reciente.",
  "analysis.story.progressDetail": "{value} frente al rango comparable anterior.",
  "analysis.story.rangeAverage": "Promedio del rango seleccionado",
  "analysis.story.ceilingMarker": "Mejor resultado guardado",
  "analysis.story.typicalMarker": "Resultado típico guardado",
  "analysis.story.floorMarker": "Piso de ronda difícil",
  "analysis.story.winLossDifference": "Diferencia entre victorias y derrotas",
  "analysis.story.winsVsLosses": "Victorias / derrotas",
  "analysis.story.winsLosses": "victorias / derrotas",
  "analysis.story.winLossDetail": "La mayor diferencia entre victorias y derrotas.",
  "analysis.story.driverAutonValue": "Driver {driver} / Autónomo {auton}",
  "analysis.story.head.auton.title": "Haz confiable el autónomo primero",
  "analysis.story.head.auton.why": "El primer cambio del partido no es estable todavía.",
  "analysis.story.head.auton.proof": "Autónomo ganado: {rate}. Margen promedio: {margin}.",
  "analysis.story.head.auton.target": "Ejecuta un autónomo repetible que gane o empate antes de agregar riesgo.",
  "analysis.story.head.center.title": "Termina con control del centro",
  "analysis.story.head.center.why": "El centro convierte robots de midfield y amarillos centrales en puntos repetibles.",
  "analysis.story.head.center.proof": "Controlas el centro {rate} del tiempo; los puntos perdidos promedian {missed}.",
  "analysis.story.head.center.target": "Practica los últimos 20 segundos alrededor del posicionamiento central.",
  "analysis.story.head.yellow.title": "Puntúa los amarillos que ya colocas",
  "analysis.story.head.yellow.why": "Los amarillos solo importan con propiedad correcta; convertir vale más que volumen bruto.",
  "analysis.story.head.yellow.proof": "{scored} de {placed} amarillos contaron, una conversión de {rate}.",
  "analysis.story.head.yellow.target": "Confirma la propiedad del toggle antes de poner más amarillos.",
  "analysis.story.head.floor.title": "Sube el piso de los malos partidos",
  "analysis.story.head.floor.why": "El techo existe, pero las rondas difíciles bajan el promedio.",
  "analysis.story.head.floor.proof": "El promedio es {average}; el piso bajo del rango es {floor}.",
  "analysis.story.head.floor.target": "Construye un plan de bajo riesgo para partidos desordenados.",
  "analysis.story.head.margin.title": "Crea más separación",
  "analysis.story.head.margin.why": "Los partidos cerrados necesitan cambios de puntos más limpios, sobre todo autónomo y pines controlados.",
  "analysis.story.head.margin.proof": "La tasa de victoria es {rate}; el margen promedio es {margin}.",
  "analysis.story.head.margin.target": "Practica los dos cambios más rápidos que agregan margen.",
  "analysis.story.head.ceiling.title": "Convierte el mejor patrón en el patrón normal",
  "analysis.story.head.ceiling.why": "Los datos dicen que el camino funciona; el salto viene de repetirlo.",
  "analysis.story.head.ceiling.proof": "El promedio es {average}; el promedio de pines rojos/azules es {pins}.",
  "analysis.story.head.ceiling.target": "Repite el patrón de mejores partidos hasta que sea rutina.",
  "analysis.story.skills.balance.title": "Guarda rutas Driver y Autónomo",
  "analysis.story.skills.balance.why": "El techo combinado solo se ve cuando hay datos de ambos tipos de ruta.",
  "analysis.story.skills.balance.proof": "Intentos Driver: {driver}. Intentos Autónomo: {auton}.",
  "analysis.story.skills.balance.target": "Registra intentos Driver y Autónomo juntos en la misma práctica.",
  "analysis.story.skills.driver.title": "Estabiliza la ruta Driver",
  "analysis.story.skills.driver.why": "Autónomo supera a Driver, así que repetir Driver suma techo más rápido.",
  "analysis.story.skills.driver.proof": "Driver promedia {driver}; Autónomo promedia {auton}.",
  "analysis.story.skills.driver.target": "Practica una ruta Driver más segura antes de perseguir máximo de pines.",
  "analysis.story.skills.auton.title": "Construye la ruta Autónoma",
  "analysis.story.skills.auton.why": "Driver sostiene el puntaje; mejorar autónomo sube directamente el combinado.",
  "analysis.story.skills.auton.proof": "Driver promedia {driver}; Autónomo promedia {auton}.",
  "analysis.story.skills.auton.target": "Agrega una secuencia autónoma confiable.",
  "analysis.story.skills.yellow.title": "Convierte más amarillos",
  "analysis.story.skills.yellow.why": "Se colocan amarillos, pero no siempre se vuelven legales por propiedad/control.",
  "analysis.story.skills.yellow.proof": "{scored} de {placed} amarillos puntuaron, una conversión de {rate}.",
  "analysis.story.skills.yellow.target": "Practica estados de toggle antes de agregar más amarillos.",
  "analysis.story.skills.center.title": "Haz automático el control del centro",
  "analysis.story.skills.center.why": "El control central protege el valor amarillo y evita pérdidas en la ruta.",
  "analysis.story.skills.center.proof": "El toggle central está activo en {rate} de los intentos guardados.",
  "analysis.story.skills.center.target": "Agrega un punto de control central consistente a la ruta.",
  "analysis.story.skills.ceiling.title": "Empuja el techo combinado",
  "analysis.story.skills.ceiling.why": "La base de ruta está sana; la mejora viene de refinar la secuencia de mayor valor.",
  "analysis.story.skills.ceiling.proof": "El mejor combinado es {combined}; la forma reciente es {recent}.",
  "analysis.story.skills.ceiling.target": "Elige un segmento de ruta y busca ejecución más limpia.",
  "analysis.replay.kicker": "Historia de rendimiento",
  "analysis.replay.title": "Repetición de Temporada",
  "analysis.replay.modeAria": "Tipo de repetición",
  "analysis.replay.period": "Período seleccionado",
  "analysis.replay.confidence": "Confianza de la lectura",
  "analysis.replay.confidenceEarly": "Lectura inicial",
  "analysis.replay.confidenceDeveloping": "Señal en desarrollo",
  "analysis.replay.confidenceStrong": "Señal fuerte",
  "analysis.replay.intro": "Esto es lo que muestran tus datos de práctica.",
  "analysis.replay.shapeImproving": "Los puntajes han mejorado de forma constante.",
  "analysis.replay.shapeRecovery": "Los puntajes bajaron a mitad de temporada y luego se recuperaron.",
  "analysis.replay.shapeSteady": "Los puntajes se han mantenido constantes.",
  "analysis.replay.shapeDecline": "Los puntajes recientes han bajado.",
  "analysis.replay.chapterTrajectory": "Trayectoria",
  "analysis.replay.chapterTurning": "Punto de giro",
  "analysis.replay.chapterAnatomy": "Desglose del partido",
  "analysis.replay.chapterSkillsAnatomy": "Desglose del intento",
  "analysis.replay.chapterPractice": "Plan de práctica",
  "analysis.replay.trajectoryDetail": "Sigue cada resultado exacto y la tendencia de cinco registros a lo largo del tiempo.",
  "analysis.replay.trajectoryMarginDetail": "Cada punto es un partido. La línea comienza en el partido 10 y sigue promedios completos de 10 partidos.",
  "analysis.replay.metricAria": "Métrica de trayectoria frente a frente",
  "analysis.replay.metricScore": "Puntaje de alianza",
  "analysis.replay.metricMargin": "Margen del partido",
  "analysis.replay.legendDots": "Puntos: puntaje final de tu alianza",
  "analysis.replay.legendMarginDots": "Puntos: margen final del partido",
  "analysis.replay.legendSkillsDots": "Puntos: puntajes de Skills guardados",
  "analysis.replay.legendTrend": "Línea gris: resultados exactos",
  "analysis.replay.legendRolling": "Línea cian: promedio de 5 registros",
  "analysis.replay.legendMarginRolling": "Línea cian: margen promedio de 10 partidos",
  "analysis.replay.legendRecent": "Corchete: últimos {count}",
  "analysis.replay.axisHeadX": "Número de partido de práctica",
  "analysis.replay.axisHeadY": "Puntaje final de nuestra alianza (puntos)",
  "analysis.replay.axisHeadMarginY": "Margen del partido (puntos)",
  "analysis.replay.axisSkillsX": "Número de intento de práctica",
  "analysis.replay.axisSkillsY": "Puntaje del intento de Skills (puntos)",
  "analysis.replay.latestBracket": "Últimos {count}",
  "analysis.replay.firstTenAverage": "Promedio inicial de 10: {value}",
  "analysis.replay.latestTenAverage": "Promedio reciente de 10: {value}",
  "analysis.replay.marginImprovement": "Mejora del margen: {value} puntos",
  "analysis.replay.startingLevel": "Nivel inicial",
  "analysis.replay.currentLevel": "Nivel actual",
  "analysis.replay.biggestTurn": "Mayor giro",
  "analysis.replay.turningDetail": "Esta es la diferencia repetible más importante de los datos seleccionados.",
  "analysis.replay.whenWorking": "Cuando funciona",
  "analysis.replay.whenMissing": "Cuando falla",
  "analysis.replay.averageScoreShort": "puntaje promedio",
  "analysis.replay.pointSwing": "cambio de {value} puntos",
  "analysis.replay.anatomyDetail": "Un veredicto por fase. La fase más débil se convierte en la primera misión.",
  "analysis.replay.practiceDetail": "Tres misiones, en orden. Completa la primera meta antes de añadir complejidad.",
  "analysis.replay.whyItMatters": "Por qué importa",
  "analysis.replay.successTarget": "Meta de éxito",
  "analysis.replay.evidenceTitle": "Explorar la evidencia",
  "analysis.replay.evidenceDetail": "Abre los números, comparaciones y correlaciones detrás de esta repetición.",
  "analysis.replay.numberProof": "Prueba numérica",
  "analysis.replay.winLossProof": "Qué cambia entre victorias y derrotas",
  "analysis.replay.skillsProof": "Prueba de Driver y Autónomo",
  "analysis.replay.noDataTitle": "La repetición necesita datos guardados",
  "analysis.replay.noHeadData": "Guarda partidos frente a frente para construir tu historia de rendimiento.",
  "analysis.replay.noSkillsData": "Guarda intentos Driver y Autónomo para construir la historia de tu ruta.",
  "analysis.replay.pointHint": "Pasa el cursor o enfoca un punto para leer ese registro.",
  "analysis.replay.dateTurn": "{date}, un cambio de {value} puntos",
  "analysis.replay.missionHeadAutonWhy": "Una apertura repetible elimina el primer punto de presión de cada partido.",
  "analysis.replay.missionHeadCenterWhy": "El control del centro protege puntos de robots y amarillos legales al final.",
  "analysis.replay.missionHeadYellowWhy": "Los amarillos colocados solo importan cuando la propiedad los hace puntuar.",
  "analysis.replay.missionHeadFloorWhy": "Un plan mínimo seguro evita que una secuencia mala decida el partido.",
  "analysis.replay.missionHeadReviewWhy": "Nuevos partidos guardados demuestran si el cambio funciona en juego real.",
  "analysis.replay.missionSkillsDriverWhy": "Una ruta Driver estable convierte máximos en puntajes repetibles.",
  "analysis.replay.missionSkillsAutonWhy": "Mejorar Autónomo aumenta directamente el techo combinado de Skills.",
  "analysis.replay.missionSkillsYellowWhy": "La propiedad correcta convierte los pines de la ruta en puntos reales.",
  "analysis.replay.missionSkillsCenterWhy": "Un punto de control central fiable evita perder valor al final de la ruta.",
  "analysis.replay.missionSkillsReviewWhy": "Intentos emparejados muestran si Driver y Autónomo mejoran juntos.",
  "scouting.skillsKicker": "Clasificación oficial de Skills",
  "judge.notice": "Se cargaron datos de muestra preparados para 4330P RoboPigeons para ahorrar tiempo de revisión.",
  "judge.identityKicker": "Equipo reconocido",
  "judge.identitySource": "Datos del equipo verificados con eventos VEX sincronizados",
  "judge.robot": "Robot",
  "judge.organization": "Organización",
  "judge.location": "Ubicación",
  "judge.officialSkills": "Skills oficiales de Override",
  "judge.officialSkillsPending": "Todavía no se ha publicado un puntaje oficial de Override Skills para 4330P.",
  "judge.officialSkillsFound": "Los resultados oficiales de Override Skills para 4330P aparecen abajo.",
  "scouting.teamSkillsTitle": "Búsqueda de Skills por equipo",
  "scouting.teamSkillsDescription": "Busca equipos en la clasificación pública VEX V5RC Override Skills.",
  "scouting.teamSearch": "Buscar equipo",
  "scouting.teamSearchPlaceholder": "Número, nombre, ciudad, región o código del evento",
  "scouting.searchTeams": "Buscar equipos",
  "scouting.teamSkillsInitial": "Busca resultados oficiales de Skills por número, nombre o región.",
  "scouting.dataKicker": "Importación de datos oficiales",
  "scouting.competitionData": "Datos de competencia",
  "scouting.competitionDescription": "Busca datos sincronizados de eventos VEX, importa equipos y guarda detalles oficiales para análisis.",
  "scouting.findCompetition": "Buscar competencia",
  "scouting.findPlaceholder": "Ransom, Miami, 65030, Florida, 4330P...",
  "scouting.region": "Región",
  "scouting.allSyncedRegions": "Todas las regiones sincronizadas",
  "scouting.showEvents": "Mostrar eventos",
  "scouting.loadingCompetitions": "Cargando competencias sincronizadas...",
  "scouting.importedCompetition": "Competencia importada",
  "scouting.syncedLocal": "Datos locales sincronizados",
  "scouting.noSyncedData": "Sin datos sincronizados",
  "scouting.liveProxy": "Proxy en vivo conectado",
  "scouting.noProxy": "Proxy no conectado",
  "scouting.searchingSkills": "Buscando en la clasificación pública de Skills...",
  "scouting.foundTeams.one": "Se encontró {count} equipo.",
  "scouting.foundTeams.many": "Se encontraron {count} equipos.",
  "scouting.noTeams": "No se encontraron equipos.",
  "scouting.noTeamsLong": "No se encontraron equipos en la clasificación pública de Skills.",
  "scouting.typeTwo": "Escribe al menos 2 caracteres para buscar equipos.",
  "scouting.skillsError": "No se pudieron cargar los datos de Skills. Inténtalo más tarde.",
  "scouting.dataError": "No se pudieron cargar los datos de competencia. Inténtalo más tarde.",
  "scouting.proxyNeeded": "Los datos VEX en vivo necesitan el proxy para cargar resultados oficiales.",
  "scouting.noSynced": "No hay competencias sincronizadas todavía. Ejecuta el colector VEX e importa un paquete.",
  "scouting.searchingCompetitions": "Buscando competencias sincronizadas...",
  "scouting.noCompetitionMatches": "No se encontraron competencias.",
  "scouting.foundCompetitions.one": "Se encontró {count} competencia sincronizada.",
  "scouting.foundCompetitions.many": "Se encontraron {count} competencias sincronizadas.",
  "scouting.foundAcross.one": "Se encontraron {count} competencias en {regions} región coincidente.",
  "scouting.foundAcross.many": "Se encontraron {count} competencias en {regions} regiones coincidentes.",
  "scouting.noRegionMatch": "Ninguna región sincronizada coincide con \"{query}\".",
  "scouting.loaded.one": "{count} competencia sincronizada cargada.{updated}",
  "scouting.loaded.many": "{count} competencias sincronizadas cargadas.{updated}",
  "scouting.lastUpdated": " Última actualización {date}.",
  "scouting.myCompetitions": "Mis competencias",
  "scouting.enterTeam": "Ingresa un número de equipo durante la configuración para detectar tus eventos.",
  "scouting.noMyEvents": "No se encontraron competencias sincronizadas para {team}.",
  "scouting.tryAll": "Prueba buscar en todos los eventos sincronizados abajo.",
  "scouting.myEvents.one": "{count} evento sincronizado encontrado para {team}",
  "scouting.myEvents.many": "{count} eventos sincronizados encontrados para {team}",
  "scouting.event": "Evento",
  "scouting.unnamedEvent": "Evento sin nombre",
  "scouting.count.teams": "{count} equipos",
  "scouting.count.skills": "{count} skills",
  "scouting.count.awards": "{count} premios",
  "scouting.viewImport": "Ver / Importar",
  "scouting.regionNotListed": "Región no listada",
  "scouting.dateNotListed": "Fecha no listada",
  "scouting.allMatchingRegions": "Todas las regiones que coinciden con \"{query}\"",
  "scouting.allMatchingMeta": "{regions} regiones sincronizadas - {events} eventos",
  "scouting.showEveryEvent": "Mostrar todos los eventos importados",
  "scouting.syncedEvents.one": "{count} evento sincronizado",
  "scouting.syncedEvents.many": "{count} eventos sincronizados",
  "scouting.teams": "Equipos",
  "scouting.teamsHint": "Haz clic en un equipo para ver Skills de temporada y detalles del evento.",
  "scouting.noRegisteredTeams": "Todavía no hay equipos registrados listados.",
  "scouting.awards": "Premios",
  "scouting.awardsSynced.one": "{count} premio sincronizado para este evento.",
  "scouting.awardsSynced.many": "{count} premios sincronizados para este evento.",
  "scouting.noAwards": "Todavía no hay premios publicados.",
  "scouting.winnerNotListed": "Ganador no listado",
  "filters.all": "Todos",
  "filters.mine": "Mis competencias",
  "filters.usa": "Estados Unidos",
  "filters.upcoming": "Próximos",
  "filters.past": "Pasados",
  "toast.enterTeam": "Ingresa primero tu número de equipo.",
  "toast.matchDeleted": "Partido eliminado.",
  "toast.confirmDelete": "Presiona Confirmar eliminación para quitar este partido.",
  "toast.matchesCleared": "Partidos guardados borrados.",
  "toast.localWiped": "Datos locales de la app borrados.",
  "toast.invalidJson": "JSON inválido. El partido no cambió.",
  "toast.editNeedsId": "El partido editado necesita un id.",
  "toast.matchUpdated": "Partido actualizado.",
  "toast.competitionImported": "Datos de competencia importados.",
  "toast.sampleRebuilt": "Datos de muestra reconstruidos.",
  "toast.chooseAlliance": "Elige tu color de alianza antes de guardar.",
  "toast.chooseSkillsType": "Elige Driver o Autónomo antes de guardar.",
  "toast.matchSaveFailed": "No se pudo guardar el partido en este dispositivo.",
  "toast.matchSaved": "Partido guardado en este dispositivo.",
  "toast.skillsSaveFailed": "No se pudo guardar el intento de Skills en este dispositivo.",
  "toast.skillsSaved": "Intento de Skills guardado en este dispositivo.",
  "toast.teamNameSaved": "{teamNumber} {teamName} guardado en este dispositivo.",
  "toast.teamSaved": "Equipo {teamNumber} guardado en este dispositivo.",
  "setup.confirmIdentity": "¿Eres {teamNumber} {teamName}?",
  "setup.checkAnother": "Buscar otro equipo",
  "aria.decreasePins": "Disminuir pines {color} en el cuadrante {quadrant}",
  "aria.increasePins": "Aumentar pines {color} en el cuadrante {quadrant}",
  "aria.pinsInQuadrant": "Pines {color} en el cuadrante {quadrant}",
  "scouting.date": "Fecha",
  "scouting.rank": "Rango #{rank}",
  "scouting.officialSkillsResult": "Resultado oficial de Skills",
  "scouting.noExtraTeamDetails": "No hay más detalles del equipo.",
  "scouting.eventWithId": "Evento {id}",
  "scouting.syncedDataCounts": "Conteos de datos sincronizados",
  "scouting.teamDetails": "Detalles del equipo",
  "scouting.seasonSkills": "Skills de temporada",
  "scouting.eventSkills": "Skills del evento",
  "scouting.robot": "Robot",
  "scouting.noAdditionalTeamDetails": "No hay detalles adicionales del equipo.",
  "scouting.attempts": "{count} intentos",
  "scouting.award": "Premio",
  "scouting.loadedDetail": "Cargado {date}. {skills} filas de Skills - {awards} premios.",
  "scouting.onlyImportedRegions": "Aquí solo aparecen regiones importadas de la temporada 204.",
  "analysis.matchesLabel": "partidos",
  "analysis.runsLabel": "intentos",
  "analysis.recentDetail": "últimos {count}, {delta} vs promedio del rango",
  "analysis.recordDetail": "{wins}V {losses}D {ties}E",
  "analysis.winFactors": "Qué suele ayudarnos a ganar",
  "analysis.winFactorsEmpty": "Guarda partidos más variados para identificar qué se relaciona más con ganar.",
  "analysis.winFactorsDetail": "Las relaciones simples más fuertes con ganar en este rango.",
  "analysis.learning": "Aprendiendo",
  "analysis.topCount": "Top {count}",
  "analysis.missedPoints": "Puntos perdidos",
  "analysis.missedPointsDetail": "Puntos estimados que quedaron por amarillos no poseídos, autónomo perdido/empatado y falta de robots/control en midfield.",
  "analysis.avgValue": "{value} prom.",
  "analysis.autonReliability": "Confiabilidad autónoma",
  "analysis.percentWon": "{value} ganado",
  "analysis.autonReliabilityDetail": "Resultado autónomo comparado con el margen final.",
  "analysis.wonAuton": "Ganó autónomo",
  "analysis.tiedAuton": "Empató autónomo",
  "analysis.lostAuton": "Perdió autónomo",
  "analysis.avgMargin": "margen prom. {value}",
  "analysis.centerImpact": "Impacto del control central",
  "analysis.centerImpactDetail": "Margen prom. con centro: {withCenter}. Sin centro: {withoutCenter}.",
  "analysis.swing": "{value} diferencia",
  "analysis.yellowEfficiency": "Eficiencia de toggles/amarillos",
  "analysis.yellowEfficiencyDetail": "{scored} de {placed} pines amarillos contaron para tu alianza en este rango.",
  "analysis.floorCeilingDetail": "Rango bajo/alto realista usando percentiles, menos variable que peor/mejor crudo.",
  "analysis.previousAverage": "El rango comparable anterior promedió {value}.",
  "analysis.needEarlierData": "Se necesitan datos guardados anteriores para comparar rangos.",
  "analysis.bestBlueprint": "Patrón de mejores partidos",
  "analysis.bestBlueprintDetail": "Tus mejores 3 promediaron {pins} pines rojos/azules y {yellows} amarillos poseídos. Centro controlado {center}/3 veces; autónomo ganado {auton}/3.",
  "analysis.badGoodRange": "Rango de mal día / buen día",
  "analysis.weeklyProgress": "Progreso semanal",
  "analysis.yellowConversion": "Conversión de amarillos",
  "analysis.yellowConversionDetail": "{scored} de {placed} pines amarillos puntuaron bajo las reglas de posesión de Skills.",
  "analysis.skillsRouteProgress": "Progreso de rutas Skills",
  "analysis.skillsRouteProgressDetail": "Compara intentos nuevos contra antiguos por separado para Driver y Autónomo.",
  "analysis.driverTrend": "Tendencia Driver",
  "analysis.autonTrend": "Tendencia Autónoma",
  "analysis.checkDetails": "Ver detalles",
  "analysis.nextPractice": "Próxima práctica",
  "analysis.routeBase": "Base de ruta",
  "analysis.missedCount": "{count} perdidos",
  "analysis.correlationGroup.score": "Puntuación",
  "analysis.correlationGroup.pins": "Pines",
  "analysis.correlationGroup.zones": "Zonas",
  "analysis.correlationGroup.control": "Control",
  "analysis.correlationGroup.autonomous": "Autónomo",
  "analysis.correlationOption.ourScore": "Nuestra puntuación",
  "analysis.correlationOption.opponentScore": "Puntuación rival",
  "analysis.correlationOption.margin": "Margen de puntuación",
  "analysis.correlationOption.totalMatchScore": "Puntuación total del partido",
  "analysis.correlationOption.win": "Resultado de victoria",
  "analysis.correlationOption.alliancePins": "Nuestros pines rojos/azules",
  "analysis.correlationOption.opponentPins": "Pines rojos/azules rivales",
  "analysis.correlationOption.totalRedBluePins": "Total pines rojos + azules",
  "analysis.correlationOption.totalPins": "Total de pines colocados",
  "analysis.correlationOption.ownedYellow": "Nuestros pines amarillos poseídos",
  "analysis.correlationOption.opponentOwnedYellow": "Pines amarillos rivales poseídos",
  "analysis.correlationOption.yellowPins": "Pines amarillos colocados",
  "analysis.correlationOption.ourOuterToggles": "Toggles exteriores nuestros",
  "analysis.correlationOption.opponentOuterToggles": "Toggles exteriores rivales",
  "analysis.correlationOption.centerControl": "Centro controlado por nosotros",
  "analysis.correlationOption.midfieldRobots": "Nuestros robots en midfield",
  "analysis.correlationOption.opponentMidfieldRobots": "Robots rivales en midfield",
  "analysis.correlationOption.autonPoints": "Puntos de autónomo",
  "analysis.correlationOption.autonWon": "Autónomo ganado",
  "analysis.correlationOption.autonLost": "Autónomo perdido",
  "analysis.correlationOption.autonTied": "Autónomo empatado",
  "analysis.correlationOption.score": "Puntuación Skills",
  "analysis.correlationOption.driverRun": "Intento Driver",
  "analysis.correlationOption.autonRun": "Intento Autónomo",
  "analysis.correlationOption.redBluePins": "Total pines rojos + azules",
  "analysis.correlationOption.redPins": "Pines rojos anotados",
  "analysis.correlationOption.bluePins": "Pines azules anotados",
  "analysis.correlationOption.scoredYellow": "Pines amarillos anotados",
  "analysis.correlationOption.midfield": "Toggle central activo",
  "analysis.correlationOption.correctYellowOwnership": "Conteo correcto de posesión amarilla",
  "analysis.correlationOption.missedYellowPins": "Pines amarillos perdidos",
  "analysis.zoneOption.TotalPins": "Pines totales en {quadrant}",
  "analysis.zoneOption.OurPins": "Nuestros pines en {quadrant}",
  "analysis.zoneOption.OpponentPins": "Pines rivales en {quadrant}",
  "analysis.zoneOption.OwnedYellow": "Amarillos poseídos en {quadrant}",
  "analysis.zoneOption.Pins": "Pines en {quadrant}",
  "analysis.headWorkingRecent": "Tus últimos {count} partidos están {delta} puntos por encima de este rango.",
  "analysis.headWorkingWinRate": "Estás ganando el {rate} de los partidos en este rango.",
  "analysis.headWorkingBaseline": "Tu base actual es {average} puntos. Ese es el número que hay que subir.",
  "analysis.headCostingYellows": "La posesión de amarillos es la fuga más visible: {scored} de {placed} amarillos contaron.",
  "analysis.headCostingAuton": "El autónomo aún no es confiable: {rate} ganado en este rango.",
  "analysis.headCostingMissed": "La estimación de puntos perdidos promedia {missed} por partido.",
  "analysis.headFocusCenter": "Prioriza terminar con más control de midfield; conecta directamente con puntos de robots y amarillos centrales.",
  "analysis.headFocusYellows": "Asegura la posesión de toggles antes de colocar más pines amarillos.",
  "analysis.headFocusBlueprint": "Sigue construyendo sobre el patrón de tus mejores partidos y sube el piso en rondas difíciles.",
  "analysis.headNoteUp": "Tus partidos recientes suben {delta} puntos sobre el promedio de este rango. Mantén esa mejora y busca los {missed} puntos estimados perdidos.",
  "analysis.headNoteDown": "Tus últimos {count} partidos están por debajo del promedio del rango. Empieza por puntos repetibles: autónomo, control central y amarillos que sí cuentan.",
  "analysis.headNoteSteady": "Tu rendimiento está estable alrededor de {average} puntos. La mejora más rápida es convertir amarillos/control perdidos en puntos seguros.",
  "analysis.skillsWorkingRecent": "Tus últimos {count} intentos de Skills están {delta} puntos por encima de este rango.",
  "analysis.skillsWorkingCombined": "Mejor combinado: {combined}; Driver {driver} más Autónomo {auton}.",
  "analysis.skillsCostingYellows": "{missed} de {placed} pines amarillos no puntuaron porque faltaba la condición de posesión.",
  "analysis.skillsCostingNoYellows": "Guarda intentos con amarillos y toggles para encontrar la fuga principal.",
  "analysis.skillsFocusAuton": "Usa Driver como base estable y sube Autónomo hasta que salte el combinado.",
  "analysis.skillsFocusDriver": "Autónomo está fuerte; ahora haz que Driver sea más repetible.",
  "analysis.skillsNoteSplit": "Tu promedio de Skills es {average}. Driver promedia {driver} y Autónomo {auton}; la próxima mejora está en la ruta menos repetible.",
  "analysis.skillsNoteOneType": "Tu promedio de Skills es {average}. Guarda intentos Driver y Autónomo para ver el techo combinado real."
});
Object.assign(translations["zh-CN"], {
  "aria.appOverview": "应用概览",
  "aria.savedSummary": "已保存比赛摘要",
  "aria.scoringMode": "计分模式",
  "aria.skillsPanel": "技能赛分析和计分器",
  "aria.skillsReset": "技能赛重置",
  "aria.skillsScore": "技能赛分数",
  "aria.skillsRunType": "技能赛类型",
  "aria.resetScorer": "重置计分器",
  "aria.liveScore": "实时分数",
  "aria.closeSaveMatch": "关闭保存比赛对话框",
  "aria.closeSkillsSave": "关闭保存技能赛对话框",
  "aria.closeDevEdit": "关闭开发编辑对话框",
  "brand.title": "Override 计分分析器",
  "brand.credit": "制作 - 4330P RoboPigeons",
  "banner.team": "队伍",
  "banner.matches": "比赛",
  "banner.record": "战绩",
  "judge.practiceMatches": "练习赛",
  "judge.practiceRecord": "练习赛战绩",
  "language.label": "语言",
  "language.aria": "语言",
  "tabs.head": "对抗赛",
  "tabs.skills": "技能赛",
  "tabs.scouting": "侦察",
  "tabs.analysis": "分析",
  "range.today": "今天",
  "range.7": "7天",
  "range.30": "30天",
  "range.all": "全部",
  "range.custom": "自定义",
  "range.start": "开始",
  "range.end": "结束",
  "common.optional": "可选",
  "common.notListed": "未列出",
  "common.notLoaded": "未加载",
  "common.notSaved": "未保存",
  "common.notEntered": "未填写",
  "common.cancel": "取消",
  "common.team": "队伍",
  "color.red": "红",
  "color.blue": "蓝",
  "color.yellow": "黄",
  "color.neutral": "中立",
  "quadrant.top": "上方",
  "quadrant.right": "右侧",
  "quadrant.bottom": "下方",
  "quadrant.left": "左侧",
  "quadrant.center": "中心",
  "match.saveMatch": "保存比赛",
  "match.redAuton": "红方自动",
  "match.blueAuton": "蓝方自动",
  "skills.score": "技能赛分数",
  "skills.driver": "驾驶",
  "skills.autonomous": "自动",
  "skills.saveRun": "保存尝试",
  "history.matchTitle": "比赛历史",
  "history.matchDescription": "此设备上最近保存的比赛。",
  "history.matchEmpty": "计分并保存后，比赛会显示在这里。",
  "history.skillsTitle": "技能赛历史",
  "history.skillsDescription": "此设备上最近保存的技能赛尝试。",
  "history.skillsEmpty": "计分并保存后，技能赛尝试会显示在这里。",
  "history.showMore": "显示更多",
  "history.showLess": "显示更少",
  "history.confirmDelete": "确认删除",
  "history.deleteMatch": "删除比赛",
  "history.savedMatch": "已保存比赛",
  "history.result.saved": "已保存",
  "history.result.win": "胜",
  "history.result.loss": "负",
  "history.result.tie": "平",
  "history.team": "队伍",
  "history.alliance": "联盟",
  "history.ourScore": "我方分数",
  "history.opponentScore": "对手分数",
  "history.partner": "队友",
  "history.opponentOne": "对手 1",
  "history.opponentTwo": "对手 2",
  "history.runType": "尝试类型",
  "history.notes": "备注",
  "setup.title": "队伍设置",
  "setup.description": "输入一次队号。此应用会在本设备记住它。",
  "setup.teamNumber": "你的队号",
  "setup.checkTeam": "查找队伍",
  "setup.checking": "正在查找...",
  "setup.teamFound": "找到队伍",
  "setup.yesContinue": "是，继续",
  "setup.noEdit": "否，修改队号",
  "saveMatch.title": "保存比赛",
  "saveMatch.description": "所有详情都是可选的。分数和完整场地状态会自动保存。",
  "saveMatch.partnerTeam": "联盟队友队号",
  "saveMatch.partnerNotes": "队友备注",
  "saveMatch.opponentOne": "对手 1 队号/名称",
  "saveMatch.opponentOneNotes": "对手 1 备注",
  "saveMatch.opponentTwo": "对手 2 队号/名称",
  "saveMatch.opponentTwoNotes": "对手 2 备注",
  "saveMatch.skip": "跳过详情",
  "saveSkills.title": "保存技能赛尝试",
  "saveSkills.description": "备注是可选的。分数和完整技能赛场地状态会自动保存。",
  "saveSkills.notes": "尝试备注",
  "saveSkills.skip": "跳过备注",
  "dev.title": "开发模式",
  "dev.description": "编辑已保存记录，或清除此设备上的本地测试数据。",
  "dev.autofill": "自动填入示例数据",
  "dev.clearMatches": "清除比赛",
  "dev.wipeAll": "清除全部数据",
  "dev.generatedScenario": "生成的情景",
  "dev.coachSelected": "教练建议",
  "dev.seasonShape": "赛季走势",
  "dev.selectorMismatch": "生成与建议不匹配",
  "dev.editTitle": "编辑已保存比赛",
  "dev.editDescription": "开发模式：直接编辑已保存比赛 JSON。无效 JSON 不会保存。",
  "dev.saveChanges": "保存更改",
  "dev.tools": "开发工具",
  "dev.editJson": "编辑 JSON",
  "analysis.kicker": "本地表现",
  "analysis.title": "我的表现",
  "analysis.description": "此设备上已保存比赛和技能赛的分数趋势。",
  "analysis.rangeAria": "分析日期范围",
  "analysis.head.emptySummary": "保存比赛以解锁对抗赛分析。",
  "analysis.skills.emptySummary": "保存技能赛尝试以解锁技能赛分析。",
  "analysis.head.emptyPanel": "保存对抗赛比赛以解锁此面板。",
  "analysis.skills.emptyPanel": "保存技能赛尝试以解锁此面板。",
  "analysis.noRange": "此范围内没有已保存数据。",
  "analysis.matches.one": "{count} 场比赛",
  "analysis.matches.many": "{count} 场比赛",
  "analysis.runs.one": "{count} 次尝试",
  "analysis.runs.many": "{count} 次尝试",
  "analysis.summaryAverage": "此范围平均 {score} 分。",
  "analysis.coachNote": "教练提示",
  "analysis.averageScore": "平均分",
  "analysis.winRate": "胜率",
  "analysis.best": "最好",
  "analysis.median": "中位数",
  "analysis.worst": "最差",
  "analysis.last5": "最近5次 vs 平均",
  "analysis.trendTitle": "我们在进步吗？",
  "analysis.trendDetail.match": "每个点是一场已保存比赛，按从旧到新排列。",
  "analysis.trendDetail.run": "每个点是一次已保存尝试，按从旧到新排列。",
  "analysis.needTrend": "至少需要 2 条记录才能显示趋势。",
  "analysis.low": "低 {value}",
  "analysis.high": "高 {value}",
  "analysis.oldest": "最旧 {value}",
  "analysis.newest": "最新 {value}",
  "analysis.scoreTrend": "分数趋势",
  "analysis.pointTitle.match": "比赛 {index}: {score} 分 - {date}",
  "analysis.pointTitle.run": "尝试 {index}: {score} 分 - {date}",
  "analysis.pointDetail.match": "比赛 {index} · {date} · {result} {ourScore}–{opponentScore} · {auton}",
  "analysis.pointDetail.run": "{type}尝试 {index} · {date} · {score} 分",
  "analysis.openCorrelation": "打开相关性实验室",
  "analysis.correlationTool": "高级比较工具",
  "analysis.compare": "比较",
  "analysis.against": "对比",
  "analysis.correlationResult": "r = {r}，来自 {count} 条已保存{type}",
  "analysis.correlationHelp": "正值表示两个数字一起上升。负值表示一个上升时另一个通常下降。",
  "analysis.correlation.notEnough": "变化还不够",
  "analysis.correlation.strongPositive": "强正相关",
  "analysis.correlation.moderatePositive": "中等正相关",
  "analysis.correlation.weakPositive": "弱正相关",
  "analysis.correlation.strongNegative": "强负相关",
  "analysis.correlation.moderateNegative": "中等负相关",
  "analysis.correlation.weakNegative": "弱负相关",
  "analysis.correlation.little": "关系较弱",
  "analysis.driverAvg": "驾驶平均",
  "analysis.autonAvg": "自动平均",
  "analysis.bestDriver": "最佳驾驶",
  "analysis.bestAuton": "最佳自动",
  "analysis.bestCombined": "最佳合计",
  "analysis.skillsSplit": "技能赛拆分",
  "analysis.skillsSplitDetail": "驾驶加自动",
  "analysis.skillsQuestion": "驾驶和自动相比如何？",
  "analysis.skillsQuestionDetail": "最佳合计指最佳驾驶加最佳自动。",
  "analysis.headQuestion": "我们为什么赢或输？",
  "analysis.headQuestionDetail": "这些卡片解释战绩背后的主要得分因素。",
  "analysis.skillsSourceQuestion": "技能赛分数来自哪里？",
  "analysis.skillsSourceDetail": "驾驶和自动分开追踪，并指出黄桩/控制失误。",
  "analysis.working": "有效的地方",
  "analysis.costing": "正在丢分的地方",
  "analysis.focus": "下一步重点",
  "analysis.story.recommendedFocus": "建议重点",
  "analysis.story.why": "原因",
    "analysis.story.proof": "依据",
    "analysis.story.nextTarget": "下一步",
    "analysis.story.theStoryNow": "教练判断",
  "analysis.story.matchPhases": "比赛阶段",
  "analysis.story.openingPhase": "开局阶段",
  "analysis.story.controlPhase": "控制阶段",
  "analysis.story.finishPhase": "收尾阶段",
  "analysis.story.routeStart": "路线开局",
  "analysis.story.routeControl": "路线控制",
  "analysis.story.routeCeiling": "路线上限",
  "analysis.story.openingHeadDetail": "自动：{autonWins}胜 / {autonTies}平 / {autonLosses}负。平均自动分：{points}。",
  "analysis.story.controlHeadDetail": "中心控制：{center}。黄桩转化：{yellows}。红/蓝桩：{pins}。",
  "analysis.story.finishHeadDetail": "平均分差：{margin}。估算错失分：{missed}。",
  "analysis.story.routeStartDetail": "驾驶平均 {driver}。自动平均 {auton}。",
  "analysis.story.routeControlDetail": "中心激活 {center}。黄桩转化 {yellows}。",
  "analysis.story.strategyMap": "策略地图",
  "analysis.story.strategyMapHead": "比赛正在往哪里倾斜",
  "analysis.story.strategyMapDetail": "绿色稳住了。红色是下一个要修的漏分点。",
  "analysis.story.strategyMapSkills": "路线哪里在漏分",
  "analysis.story.strategyMapSkillsDetail": "用它快速找到路线中最弱的一段。",
  "analysis.story.mapAuton": "自动",
  "analysis.story.mapCenter": "中心",
  "analysis.story.mapYellows": "黄桩",
  "analysis.story.mapPins": "桩",
  "analysis.story.mapMargin": "分差",
  "analysis.story.mapDriver": "驾驶",
  "analysis.story.turningPoint": "转折点",
  "analysis.story.whatChanges": "获胜时什么发生变化",
  "analysis.story.nextChapter": "下一次训练",
  "analysis.story.missionAuton": "开局任务",
  "analysis.story.missionAutonDetail": "做10次练习，把自动提升到 {value} 或更高。",
  "analysis.story.missionCenter": "控制任务",
  "analysis.story.missionCenterDetail": "练最后20秒，直到中心控制变成习惯。",
  "analysis.story.missionReview": "复盘任务",
  "analysis.story.missionReviewDetail": "练习后保存五条干净记录。",
  "analysis.story.missionDriver": "驾驶任务",
  "analysis.story.missionDriverDetail": "做一条能反复超过 {value} 的驾驶路线。",
  "analysis.story.missionSkillsAutonDetail": "加入一个能反复超过 {value} 的自动序列。",
  "analysis.story.whyWeThink": "我们为什么这样判断",
  "analysis.story.whyWeThinkDetail": "来自已保存数据的三个最强信号。",
  "analysis.story.numberProof": "数字依据",
  "analysis.story.numberProofDetail": "支撑教练判断的快速数据。",
  "analysis.story.progressStory": "赛季时间线",
  "analysis.story.filmRoom": "录像分析室",
  "analysis.story.timelineStrongUp": "得分已有显著提高",
  "analysis.story.timelineUp": "得分一直在稳步提高",
  "analysis.story.timelineRecovery": "得分下滑后已经恢复",
  "analysis.story.timelineDown": "近期得分有所下降",
  "analysis.story.timelineFlat": "得分一直保持稳定",
  "analysis.story.timelineUpDetail": "近期结果高于本时段最早的结果。",
  "analysis.story.timelineDownDetail": "近期结果低于本时段最早的结果。",
  "analysis.story.timelineFlatDetail": "近期与早期结果处于相近水平。",
  "analysis.story.recentSwing": "近期变化",
  "analysis.story.strategyBreakdown": "策略拆解",
  "analysis.story.strategyDetail": "比赛通常在哪些地方赢、输或漏分。",
  "analysis.story.averageLine": "平均 {value}",
  "analysis.story.recentFive": "突出最近5次",
  "analysis.story.headSummary": "{count} 场已保存。平均 {score}。胜率 {rate}。",
  "analysis.story.skillsSummary": "{count} 次已保存。平均 {score}。最佳合计 {combined}。",
  "analysis.story.record": "战绩",
  "analysis.story.recordDetail": "此范围胜率 {rate}。",
  "analysis.story.needRecent": "此范围保存五条记录后，近期状态会更可靠。",
  "analysis.story.progressDetail": "相比上一个可比范围 {value}。",
  "analysis.story.rangeAverage": "所选范围平均",
  "analysis.story.ceilingMarker": "最佳保存结果",
  "analysis.story.typicalMarker": "典型保存结果",
  "analysis.story.floorMarker": "困难场次下限",
  "analysis.story.winLossDifference": "胜负差异",
  "analysis.story.winsVsLosses": "胜场 / 负场",
  "analysis.story.winsLosses": "胜场 / 负场",
  "analysis.story.winLossDetail": "胜场和负场之间最大的区别。",
  "analysis.story.driverAutonValue": "驾驶 {driver} / 自动 {auton}",
  "analysis.story.head.auton.title": "先让自动稳定",
  "analysis.story.head.auton.why": "比赛第一个得分摆动还不稳定。",
  "analysis.story.head.auton.proof": "自动胜率：{rate}。平均分差：{margin}。",
  "analysis.story.head.auton.target": "先跑能稳定获胜或打平的自动，再增加风险。",
  "analysis.story.head.center.title": "以中心控制结束",
  "analysis.story.head.center.why": "中心控制把 midfield 机器人和中心黄桩变成稳定分。",
  "analysis.story.head.center.proof": "中心控制率 {rate}；平均错失分 {missed}。",
  "analysis.story.head.center.target": "练习最后20秒的中心站位。",
  "analysis.story.head.yellow.title": "让已放的黄桩真正得分",
  "analysis.story.head.yellow.why": "黄桩只有拥有权正确才有价值，所以转化比数量更重要。",
  "analysis.story.head.yellow.proof": "{placed} 个黄桩中 {scored} 个计分，转化率 {rate}。",
  "analysis.story.head.yellow.target": "放更多黄桩前先确认 toggle 拥有权。",
  "analysis.story.head.floor.title": "提高差场次下限",
  "analysis.story.head.floor.why": "上限已经存在，但困难场次正在拉低平均。",
  "analysis.story.head.floor.proof": "平均 {average}，低位下限 {floor}。",
  "analysis.story.head.floor.target": "为混乱比赛准备低风险得分方案。",
  "analysis.story.head.margin.title": "拉开更多分差",
  "analysis.story.head.margin.why": "接近的比赛需要更干净的分数摆动，尤其是自动和受控桩。",
  "analysis.story.head.margin.proof": "胜率 {rate}；平均分差 {margin}。",
  "analysis.story.head.margin.target": "练习两个最快增加分差的动作。",
  "analysis.story.head.ceiling.title": "把最佳比赛模式变成常态",
  "analysis.story.head.ceiling.why": "数据说明路线有效；下一步是让它可重复。",
  "analysis.story.head.ceiling.proof": "平均分 {average}；红/蓝桩平均 {pins}。",
  "analysis.story.head.ceiling.target": "重复最佳比赛模式，直到变成常规表现。",
  "analysis.story.skills.balance.title": "同时保存驾驶和自动路线",
  "analysis.story.skills.balance.why": "只有两种路线都有数据，才能看清合计上限。",
  "analysis.story.skills.balance.proof": "驾驶尝试：{driver}。自动尝试：{auton}。",
  "analysis.story.skills.balance.target": "同一次练习中记录配对的驾驶和自动尝试。",
  "analysis.story.skills.driver.title": "稳定驾驶路线",
  "analysis.story.skills.driver.why": "自动高于驾驶，所以稳定驾驶是最快提高上限的方法。",
  "analysis.story.skills.driver.proof": "驾驶平均 {driver}；自动平均 {auton}。",
  "analysis.story.skills.driver.target": "追求最大桩数前，先练一条更稳的驾驶路线。",
  "analysis.story.skills.auton.title": "建设自动路线",
  "analysis.story.skills.auton.why": "驾驶撑住分数，自动提升会直接提高合计技能分。",
  "analysis.story.skills.auton.proof": "驾驶平均 {driver}；自动平均 {auton}。",
  "analysis.story.skills.auton.target": "增加一个可靠的自动得分序列。",
  "analysis.story.skills.yellow.title": "提高黄桩转化",
  "analysis.story.skills.yellow.why": "黄桩已经放置，但不总是被拥有权/控制变成合法分。",
  "analysis.story.skills.yellow.proof": "{placed} 个黄桩中 {scored} 个计分，转化率 {rate}。",
  "analysis.story.skills.yellow.target": "增加黄桩前先练 toggle 状态。",
  "analysis.story.skills.center.title": "让中心控制自动化",
  "analysis.story.skills.center.why": "中心控制保护黄桩价值，也减少路线漏分。",
  "analysis.story.skills.center.proof": "中心 toggle 在 {rate} 的保存尝试中激活。",
  "analysis.story.skills.center.target": "给路线加入稳定的中心控制检查点。",
  "analysis.story.skills.ceiling.title": "提高合计上限",
  "analysis.story.skills.ceiling.why": "路线基础健康，提升应来自优化最高价值的序列。",
  "analysis.story.skills.ceiling.proof": "最佳合计 {combined}；近期状态 {recent}。",
  "analysis.story.skills.ceiling.target": "选择一个路线片段，追求更干净的执行。",
  "analysis.replay.kicker": "表现故事",
  "analysis.replay.title": "赛季回放",
  "analysis.replay.modeAria": "回放类型",
  "analysis.replay.period": "所选时段",
  "analysis.replay.confidence": "结论可信度",
  "analysis.replay.confidenceEarly": "初步判断",
  "analysis.replay.confidenceDeveloping": "正在形成的信号",
  "analysis.replay.confidenceStrong": "强信号",
  "analysis.replay.intro": "这是你的练习数据所显示的结果。",
  "analysis.replay.shapeImproving": "得分一直在稳步提高。",
  "analysis.replay.shapeRecovery": "赛季中段得分下滑，随后恢复。",
  "analysis.replay.shapeSteady": "得分一直保持稳定。",
  "analysis.replay.shapeDecline": "近期得分有所下降。",
  "analysis.replay.chapterTrajectory": "走势",
  "analysis.replay.chapterTurning": "转折点",
  "analysis.replay.chapterAnatomy": "比赛解析",
  "analysis.replay.chapterSkillsAnatomy": "尝试解析",
  "analysis.replay.chapterPractice": "训练计划",
  "analysis.replay.trajectoryDetail": "查看每次准确结果和五次记录移动趋势。",
  "analysis.replay.trajectoryMarginDetail": "每个圆点代表一场比赛。趋势线从第 10 场开始，显示完整的 10 场平均值。",
  "analysis.replay.metricAria": "对抗赛走势指标",
  "analysis.replay.metricScore": "联盟得分",
  "analysis.replay.metricMargin": "比赛分差",
  "analysis.replay.legendDots": "圆点：本方联盟最终得分",
  "analysis.replay.legendMarginDots": "圆点：比赛最终分差",
  "analysis.replay.legendSkillsDots": "圆点：已保存的技能赛得分",
  "analysis.replay.legendTrend": "灰线：每次准确结果",
  "analysis.replay.legendRolling": "青色线：5 次记录平均值",
  "analysis.replay.legendMarginRolling": "青色线：10 场比赛平均分差",
  "analysis.replay.legendRecent": "括号：最近 {count} 场",
  "analysis.replay.axisHeadX": "练习赛场次",
  "analysis.replay.axisHeadY": "本方联盟最终得分（分）",
  "analysis.replay.axisHeadMarginY": "比赛分差（分）",
  "analysis.replay.axisSkillsX": "练习运行次数",
  "analysis.replay.axisSkillsY": "技能赛运行得分（分）",
  "analysis.replay.latestBracket": "最近 {count} 场",
  "analysis.replay.firstTenAverage": "前 10 场平均 {value}",
  "analysis.replay.latestTenAverage": "最近 10 场平均 {value}",
  "analysis.replay.marginImprovement": "分差提升 {value} 分",
  "analysis.replay.startingLevel": "起点水平",
  "analysis.replay.currentLevel": "当前水平",
  "analysis.replay.biggestTurn": "最大转折",
  "analysis.replay.turningDetail": "这是所选数据中最重要、最可重复的差异。",
  "analysis.replay.whenWorking": "做到时",
  "analysis.replay.whenMissing": "没做到时",
  "analysis.replay.averageScoreShort": "平均分",
  "analysis.replay.pointSwing": "{value} 分变化",
  "analysis.replay.anatomyDetail": "每个阶段一个判断。最弱阶段成为第一项训练任务。",
  "analysis.replay.practiceDetail": "依次完成三项任务。达到第一项目标后再增加复杂度。",
  "analysis.replay.whyItMatters": "为什么重要",
  "analysis.replay.successTarget": "达标目标",
  "analysis.replay.evidenceTitle": "查看数据证据",
  "analysis.replay.evidenceDetail": "展开查看支撑本次回放的数字、对比和相关性工具。",
  "analysis.replay.numberProof": "数字证据",
  "analysis.replay.winLossProof": "胜负之间发生了什么变化",
  "analysis.replay.skillsProof": "Driver 与自动技能证据",
  "analysis.replay.noDataTitle": "回放需要已保存的数据",
  "analysis.replay.noHeadData": "保存对抗赛记录后即可生成表现故事。",
  "analysis.replay.noSkillsData": "保存 Driver 和自动技能赛记录后即可生成路线故事。",
  "analysis.replay.pointHint": "悬停或聚焦数据点即可查看该条记录。",
  "analysis.replay.dateTurn": "{date}，变化 {value} 分",
  "analysis.replay.missionHeadAutonWhy": "稳定的开局能消除每场比赛的第一个压力点。",
  "analysis.replay.missionHeadCenterWhy": "控制中心能在末段保护机器人分和有效黄桩分。",
  "analysis.replay.missionHeadYellowWhy": "黄桩只有在归属正确时才真正得分。",
  "analysis.replay.missionHeadFloorWhy": "安全的最低得分方案能避免一次失误决定比赛。",
  "analysis.replay.missionHeadReviewWhy": "新的比赛记录能验证训练成果是否适用于实战。",
  "analysis.replay.missionSkillsDriverWhy": "稳定的 Driver 路线能把峰值变成可重复的成绩。",
  "analysis.replay.missionSkillsAutonWhy": "提升自动技能会直接提高组合技能分上限。",
  "analysis.replay.missionSkillsYellowWhy": "正确归属能把路线中已有的黄桩转化为真实得分。",
  "analysis.replay.missionSkillsCenterWhy": "稳定的中心检查点能避免路线后段丢分。",
  "analysis.replay.missionSkillsReviewWhy": "成对记录能显示 Driver 和自动技能是否同步进步。",
  "scouting.skillsKicker": "官方技能赛排名",
  "judge.notice": "已加载为 4330P RoboPigeons 准备的示例数据，以节省查看时间。",
  "judge.identityKicker": "已识别队伍",
  "judge.identitySource": "队伍信息已通过同步的 VEX 赛事数据验证",
  "judge.robot": "机器人",
  "judge.organization": "组织",
  "judge.location": "地点",
  "judge.officialSkills": "官方 Override 技能赛",
  "judge.officialSkillsPending": "4330P 尚未发布官方 Override 技能赛成绩。",
  "judge.officialSkillsFound": "4330P 的官方 Override 技能赛成绩如下。",
  "scouting.teamSkillsTitle": "队伍技能赛搜索",
  "scouting.teamSkillsDescription": "搜索公开 VEX V5RC Override 技能赛排名中的队伍。",
  "scouting.teamSearch": "搜索队伍",
  "scouting.teamSearchPlaceholder": "队号、名称、城市、赛区或赛事代码",
  "scouting.searchTeams": "搜索队伍",
  "scouting.teamSkillsInitial": "按队号、队名或赛区搜索官方赛季技能赛结果。",
  "scouting.dataKicker": "官方数据导入",
  "scouting.competitionData": "比赛数据",
  "scouting.competitionDescription": "搜索已同步的 VEX 赛事数据，导入队伍，并缓存官方详情用于后续分析。",
  "scouting.findCompetition": "查找比赛",
  "scouting.findPlaceholder": "Ransom, Miami, 65030, Florida, 4330P...",
  "scouting.region": "赛区",
  "scouting.allSyncedRegions": "所有已同步赛区",
  "scouting.showEvents": "显示赛事",
  "scouting.loadingCompetitions": "正在加载已同步比赛...",
  "scouting.importedCompetition": "已导入比赛",
  "scouting.syncedLocal": "已同步本地数据",
  "scouting.noSyncedData": "没有同步数据",
  "scouting.liveProxy": "实时代理已连接",
  "scouting.noProxy": "代理未连接",
  "scouting.searchingSkills": "正在搜索公开技能赛排名...",
  "scouting.foundTeams.one": "找到 {count} 支匹配队伍。",
  "scouting.foundTeams.many": "找到 {count} 支匹配队伍。",
  "scouting.noTeams": "未找到匹配队伍。",
  "scouting.noTeamsLong": "公开技能赛排名中未找到匹配队伍。",
  "scouting.typeTwo": "请输入至少 2 个字符来搜索队伍。",
  "scouting.skillsError": "无法加载队伍技能赛数据。请稍后再试。",
  "scouting.dataError": "无法加载比赛数据。请稍后再试。",
  "scouting.proxyNeeded": "实时 VEX 数据需要代理才能加载官方结果。",
  "scouting.noSynced": "还没有同步比赛。请运行 VEX 收集器并导入数据包。",
  "scouting.searchingCompetitions": "正在搜索已同步比赛...",
  "scouting.noCompetitionMatches": "未找到匹配比赛。",
  "scouting.foundCompetitions.one": "找到 {count} 场已同步比赛。",
  "scouting.foundCompetitions.many": "找到 {count} 场已同步比赛。",
  "scouting.foundAcross.one": "在 {regions} 个匹配赛区中找到 {count} 场已同步比赛。",
  "scouting.foundAcross.many": "在 {regions} 个匹配赛区中找到 {count} 场已同步比赛。",
  "scouting.noRegionMatch": "没有已同步赛区匹配 \"{query}\"。",
  "scouting.loaded.one": "已加载 {count} 场同步比赛。{updated}",
  "scouting.loaded.many": "已加载 {count} 场同步比赛。{updated}",
  "scouting.lastUpdated": " 最后更新 {date}。",
  "scouting.myCompetitions": "我的比赛",
  "scouting.enterTeam": "在设置中输入队号后，会自动识别你的赛事。",
  "scouting.noMyEvents": "未找到 {team} 的同步比赛。",
  "scouting.tryAll": "试试搜索下面所有已同步赛事。",
  "scouting.myEvents.one": "为 {team} 找到 {count} 场同步赛事",
  "scouting.myEvents.many": "为 {team} 找到 {count} 场同步赛事",
  "scouting.event": "赛事",
  "scouting.unnamedEvent": "未命名赛事",
  "scouting.count.teams": "{count} 支队伍",
  "scouting.count.skills": "{count} 条技能赛",
  "scouting.count.awards": "{count} 个奖项",
  "scouting.viewImport": "查看 / 导入",
  "scouting.regionNotListed": "未列出赛区",
  "scouting.dateNotListed": "未列出日期",
  "scouting.allMatchingRegions": "所有匹配 \"{query}\" 的赛区",
  "scouting.allMatchingMeta": "{regions} 个同步赛区 - {events} 场赛事",
  "scouting.showEveryEvent": "显示所有导入赛事",
  "scouting.syncedEvents.one": "{count} 场同步赛事",
  "scouting.syncedEvents.many": "{count} 场同步赛事",
  "scouting.teams": "队伍",
  "scouting.teamsHint": "点击队伍查看赛季技能赛和赛事详情。",
  "scouting.noRegisteredTeams": "尚未列出注册队伍。",
  "scouting.awards": "奖项",
  "scouting.awardsSynced.one": "此赛事同步了 {count} 个奖项。",
  "scouting.awardsSynced.many": "此赛事同步了 {count} 个奖项。",
  "scouting.noAwards": "还没有公布奖项。",
  "scouting.winnerNotListed": "未列出获奖者",
  "filters.all": "全部",
  "filters.mine": "我的比赛",
  "filters.usa": "美国",
  "filters.upcoming": "即将举行",
  "filters.past": "已结束",
  "toast.enterTeam": "请先输入你的队号。",
  "toast.matchDeleted": "比赛已删除。",
  "toast.confirmDelete": "按确认删除以移除此比赛。",
  "toast.matchesCleared": "已清除保存的比赛。",
  "toast.localWiped": "本地应用数据已清除。",
  "toast.invalidJson": "JSON 无效。比赛未更改。",
  "toast.editNeedsId": "编辑后的比赛需要 id。",
  "toast.matchUpdated": "比赛已更新。",
  "toast.competitionImported": "比赛数据已导入。",
  "toast.sampleRebuilt": "开发示例数据已重建。",
  "toast.chooseAlliance": "保存前请选择你的联盟颜色。",
  "toast.chooseSkillsType": "保存前请选择驾驶或自动。",
  "toast.matchSaveFailed": "无法在此设备保存比赛。",
  "toast.matchSaved": "比赛已保存在此设备。",
  "toast.skillsSaveFailed": "无法在此设备保存技能赛尝试。",
  "toast.skillsSaved": "技能赛尝试已保存在此设备。",
  "toast.teamNameSaved": "{teamNumber} {teamName} 已保存在此设备。",
  "toast.teamSaved": "队伍 {teamNumber} 已保存在此设备。",
  "setup.confirmIdentity": "你是 {teamNumber} {teamName} 吗？",
  "setup.checkAnother": "查找另一支队伍",
  "aria.decreasePins": "减少 {quadrant} 区域的{color}桩",
  "aria.increasePins": "增加 {quadrant} 区域的{color}桩",
  "aria.pinsInQuadrant": "{quadrant} 区域的{color}桩",
  "scouting.date": "日期",
  "scouting.rank": "排名 #{rank}",
  "scouting.officialSkillsResult": "官方技能赛结果",
  "scouting.noExtraTeamDetails": "没有更多队伍详情。",
  "scouting.eventWithId": "赛事 {id}",
  "scouting.syncedDataCounts": "同步数据数量",
  "scouting.teamDetails": "队伍详情",
  "scouting.seasonSkills": "赛季技能赛",
  "scouting.eventSkills": "赛事技能赛",
  "scouting.robot": "机器人",
  "scouting.noAdditionalTeamDetails": "没有额外队伍详情。",
  "scouting.attempts": "{count} 次尝试",
  "scouting.award": "奖项",
  "scouting.loadedDetail": "已加载 {date}。{skills} 条技能赛记录 - {awards} 个奖项。",
  "scouting.onlyImportedRegions": "这里只显示已导入的 204 赛季赛区。",
  "analysis.matchesLabel": "比赛",
  "analysis.runsLabel": "尝试",
  "analysis.recentDetail": "最近 {count} 次，较范围平均 {delta}",
  "analysis.recordDetail": "{wins}胜 {losses}负 {ties}平",
  "analysis.winFactors": "通常帮助我们获胜的因素",
  "analysis.winFactorsEmpty": "保存更多不同类型的比赛，以找出最影响获胜的因素。",
  "analysis.winFactorsDetail": "此范围内与获胜最相关的简单关系。",
  "analysis.learning": "学习中",
  "analysis.topCount": "前 {count}",
  "analysis.missedPoints": "错失分数",
  "analysis.missedPointsDetail": "估算来自未拥有黄桩、自动失利/平局、缺少 midfield 机器人/控制的分数损失。",
  "analysis.avgValue": "{value} 平均",
  "analysis.autonReliability": "自动可靠性",
  "analysis.percentWon": "{value} 获胜",
  "analysis.autonReliabilityDetail": "自动结果与最终分差的比较。",
  "analysis.wonAuton": "自动获胜",
  "analysis.tiedAuton": "自动平局",
  "analysis.lostAuton": "自动失利",
  "analysis.avgMargin": "平均分差 {value}",
  "analysis.centerImpact": "中心控制影响",
  "analysis.centerImpactDetail": "控制中心时平均分差：{withCenter}。未控制中心：{withoutCenter}。",
  "analysis.swing": "{value} 变化",
  "analysis.yellowEfficiency": "切换/黄桩效率",
  "analysis.yellowEfficiencyDetail": "此范围内 {placed} 个黄桩中有 {scored} 个为你的联盟计分。",
  "analysis.floorCeilingDetail": "使用保存分数百分位估算实际低/高范围，比单纯最差/最好更稳定。",
  "analysis.previousAverage": "上一个可比范围平均 {value}。",
  "analysis.needEarlierData": "需要更早保存的数据来比较范围。",
  "analysis.bestBlueprint": "最佳比赛模式",
  "analysis.bestBlueprintDetail": "最佳 3 场平均 {pins} 个红/蓝桩和 {yellows} 个拥有黄桩。中心控制 {center}/3 次；自动获胜 {auton}/3 次。",
  "analysis.badGoodRange": "低迷日 / 出色日范围",
  "analysis.weeklyProgress": "每周进步",
  "analysis.yellowConversion": "黄桩转化",
  "analysis.yellowConversionDetail": "根据技能赛拥有规则，{placed} 个黄桩中有 {scored} 个计分。",
  "analysis.skillsRouteProgress": "技能赛路线进步",
  "analysis.skillsRouteProgressDetail": "分别比较驾驶和自动的新旧尝试。",
  "analysis.driverTrend": "驾驶趋势",
  "analysis.autonTrend": "自动趋势",
  "analysis.checkDetails": "查看详情",
  "analysis.nextPractice": "下次练习",
  "analysis.routeBase": "路线基础",
  "analysis.missedCount": "错失 {count}",
  "analysis.correlationGroup.score": "分数",
  "analysis.correlationGroup.pins": "桩",
  "analysis.correlationGroup.zones": "区域",
  "analysis.correlationGroup.control": "控制",
  "analysis.correlationGroup.autonomous": "自动",
  "analysis.correlationOption.ourScore": "我方分数",
  "analysis.correlationOption.opponentScore": "对手分数",
  "analysis.correlationOption.margin": "分差",
  "analysis.correlationOption.totalMatchScore": "比赛总分",
  "analysis.correlationOption.win": "胜负结果",
  "analysis.correlationOption.alliancePins": "我方红/蓝桩",
  "analysis.correlationOption.opponentPins": "对手红/蓝桩",
  "analysis.correlationOption.totalRedBluePins": "红+蓝桩总数",
  "analysis.correlationOption.totalPins": "放置桩总数",
  "analysis.correlationOption.ownedYellow": "我方拥有黄桩",
  "analysis.correlationOption.opponentOwnedYellow": "对手拥有黄桩",
  "analysis.correlationOption.yellowPins": "已放置黄桩",
  "analysis.correlationOption.ourOuterToggles": "我方拥有外侧切换",
  "analysis.correlationOption.opponentOuterToggles": "对手拥有外侧切换",
  "analysis.correlationOption.centerControl": "我方控制中心",
  "analysis.correlationOption.midfieldRobots": "我方 midfield 机器人",
  "analysis.correlationOption.opponentMidfieldRobots": "对手 midfield 机器人",
  "analysis.correlationOption.autonPoints": "自动分",
  "analysis.correlationOption.autonWon": "自动获胜",
  "analysis.correlationOption.autonLost": "自动失利",
  "analysis.correlationOption.autonTied": "自动平局",
  "analysis.correlationOption.score": "技能赛分数",
  "analysis.correlationOption.driverRun": "驾驶尝试",
  "analysis.correlationOption.autonRun": "自动尝试",
  "analysis.correlationOption.redBluePins": "红+蓝桩总数",
  "analysis.correlationOption.redPins": "红桩得分",
  "analysis.correlationOption.bluePins": "蓝桩得分",
  "analysis.correlationOption.scoredYellow": "黄桩得分",
  "analysis.correlationOption.midfield": "中心切换激活",
  "analysis.correlationOption.correctYellowOwnership": "正确黄桩拥有数量",
  "analysis.correlationOption.missedYellowPins": "错失黄桩",
  "analysis.zoneOption.TotalPins": "{quadrant}区域总桩数",
  "analysis.zoneOption.OurPins": "我方在{quadrant}的桩",
  "analysis.zoneOption.OpponentPins": "对手在{quadrant}的桩",
  "analysis.zoneOption.OwnedYellow": "{quadrant}拥有黄桩",
  "analysis.zoneOption.Pins": "{quadrant}区域桩数",
  "analysis.headWorkingRecent": "最近 {count} 场比赛比此范围高 {delta} 分。",
  "analysis.headWorkingWinRate": "此范围内你的胜率是 {rate}。",
  "analysis.headWorkingBaseline": "当前基准是 {average} 分。下一步就是把它推高。",
  "analysis.headCostingYellows": "黄桩拥有是最明显的丢分点：{placed} 个黄桩中 {scored} 个计分。",
  "analysis.headCostingAuton": "自动还不够稳定：此范围自动胜率 {rate}。",
  "analysis.headCostingMissed": "估算每场平均错失 {missed} 分。",
  "analysis.headFocusCenter": "优先提高 midfield 控制结束率；它直接影响机器人分和中心黄桩。",
  "analysis.headFocusYellows": "放更多黄桩前，先把切换拥有权做稳。",
  "analysis.headFocusBlueprint": "继续围绕最佳比赛模式训练，同时提高失误场次的下限。",
  "analysis.headNoteUp": "最近比赛比此范围平均高 {delta} 分。保持提升，然后追掉那 {missed} 分估算错失点。",
  "analysis.headNoteDown": "最近 {count} 场低于范围平均。先抓稳定分：自动、中心控制、真正计分的黄桩。",
  "analysis.headNoteSteady": "表现稳定在 {average} 分左右。最快提升是把黄桩/控制失误变成稳定得分。",
  "analysis.skillsWorkingRecent": "最近 {count} 次技能赛比此范围高 {delta} 分。",
  "analysis.skillsWorkingCombined": "最佳合计 {combined}：驾驶 {driver} 加自动 {auton}。",
  "analysis.skillsCostingYellows": "{placed} 个黄桩中 {missed} 个因为缺少拥有条件没有得分。",
  "analysis.skillsCostingNoYellows": "保存带黄桩和切换状态的尝试，才能找到主要丢分点。",
  "analysis.skillsFocusAuton": "把驾驶作为稳定基础，再提升自动直到合计分跳升。",
  "analysis.skillsFocusDriver": "自动表现不错；现在让驾驶更可重复。",
  "analysis.skillsNoteSplit": "技能赛平均 {average}。驾驶平均 {driver}，自动平均 {auton}；下一步提升在较不稳定的路线。",
  "analysis.skillsNoteOneType": "技能赛平均 {average}。保存驾驶和自动尝试，才能看到真实合计上限。"
});

const coachGuides = {
  en: {
    headAutonCode: {
      title: "Improve your autonomous code",
      meaning: "Your autonomous result is inconsistent, so the first scoring opportunity is not dependable yet.",
      proof: "Autonomous won or tied {successCount} of {count} matches ({rate}).",
      steps: [
        "Freeze the code at its current point value instead of adding another action.",
        "Run it 10 times from the same legal starting position.",
        "Record the first failed action each time: localization, alignment, pickup, placement, or timing.",
        "Fix the most common failure and repeat the set with normal battery and field variation.",
        "Add complexity only after at least 8 of 10 runs complete correctly."
      ],
      target: "Win or tie autonomous in at least 8 of 10 practice matches."
    },
    headHoldAuton: {
      title: "Hold your autonomous advantage",
      meaning: "Your alliance often wins autonomous, but that early lead is not surviving Driver Control.",
      proof: "You converted {converted} of {autonWins} autonomous wins into match wins ({rate}).",
      steps: [
        "Review matches where autonomous was won but the match was lost.",
        "Mark where the lead disappeared: scoring pace, yellow ownership, Midfield, or an uncompleted task.",
        "Assign each alliance robot its first Driver Control job before the match.",
        "Run scrimmages that begin with a 12-point lead and protect it while continuing to score.",
        "Check whether the alliance still leads halfway through the match and at the finish."
      ],
      target: "Turn at least 7 of the next 10 autonomous wins into match wins."
    },
    headMidfield: {
      title: "Make Midfield control part of your match plan",
      meaning: "Your saved matches finish better when your alliance controls Midfield, but that result is not reliable yet.",
      proof: "Your final margin averaged {swing} points better with Midfield control; you controlled it in {rate} of matches.",
      steps: [
        "Decide before each match which robot is responsible for entering Midfield and which robot is the backup.",
        "Give the drive team one consistent call before the final 10 seconds.",
        "Practice the approach from several realistic field positions, including a blocked direct path.",
        "Rehearse the choice between sending one robot, sending both, or protecting points already secured.",
        "Score the drill only after checking robot count and ownership of the yellow pins in Midfield."
      ],
      target: "Achieve the planned Midfield result in at least 8 of 10 practice matches."
    },
    headYellow: {
      title: "Make more of your yellow pins count",
      meaning: "Yellow pins are being placed, but too many finish in quadrants your alliance does not own.",
      proof: "{scored} of {placed} placed yellow pins scored ({rate}), leaving about {missedPoints} points per match available.",
      steps: [
        "Find the quadrant losing the most yellow value.",
        "Decide whether that zone should be protected, retaken near the end, or removed from the scoring route.",
        "Use one drive-team call for a yellow pin placed without a secured Toggle.",
        "Practice placing the yellow pin and finishing with the correct Toggle state as one complete action.",
        "End every drill by checking ownership, not only whether the pin was placed."
      ],
      target: "Score at least 85% of placed yellow pins across 10 consecutive practice matches."
    },
    headToggleZone: {
      title: "Secure the {zone} Toggle",
      meaning: "The {zone} quadrant is where your alliance most often leaves placed yellow pins without ownership.",
      proof: "That quadrant contains {missedPins} missed yellow pins in this range, averaging {missedPoints} available points per match.",
      steps: [
        "Start the drill with yellow pins already placed in the {zone} quadrant.",
        "Give one robot responsibility for checking and securing that Toggle before the finish.",
        "Practice approaching it from the two most common field positions.",
        "Repeat with the Toggle neutral and opponent-owned.",
        "Finish by checking whether every yellow pin in the quadrant actually scored."
      ],
      target: "Own the {zone} Toggle in at least 8 of 10 drills when your alliance has yellow value there."
    },
    headEndgame: {
      title: "Execute the Endgame more consistently",
      meaning: "Your alliance is sometimes reaching the final seconds without completing its intended Midfield result.",
      proof: "No alliance robot finished in Midfield in {missedMatches} matches, including {closeLosses} losses within 16 points.",
      steps: [
        "Choose the Endgame result before the match instead of assuming every match needs the same plan.",
        "Assign a primary robot and a backup for that result.",
        "Use the same drive-team time call before the final 10 seconds.",
        "Practice from clear, obstructed, and wrong-side starting positions.",
        "Judge the drill by whether the chosen plan was executed, not automatically by sending both robots."
      ],
      target: "Execute the chosen Endgame plan in at least 8 of 10 practice matches."
    },
    headPins: {
      title: "Score more red and blue pins",
      meaning: "Control is reasonably stable, but your winning matches contain more alliance-colored pins than your losses.",
      proof: "Wins averaged {winningPins} alliance-colored pins; losses averaged {losingPins}, a difference of {pinGap} pins.",
      steps: [
        "Run a timed 30-second pin-scoring segment.",
        "Count completed scoring actions and identify where time is being lost.",
        "Remove one repeated delay in pickup, alignment, travel, or placement.",
        "Test the faster action inside a full match without sacrificing yellows or the Endgame.",
        "Keep the change only when the total score rises consistently."
      ],
      target: "Match the alliance-colored pin count from your winning matches in at least 8 of 10 practice matches."
    },
    headNeedData: {
      title: "Save more matches before choosing a focus",
      meaning: "There is not enough evidence yet to recommend changing your match strategy.",
      proof: "You have {count} saved matches in this range; a recommendation needs at least 10.",
      steps: [
        "Keep using your current match plan while building a baseline.",
        "Save every practice match, including losses and unusual results.",
        "Record autonomous, Toggle ownership, pins, and Midfield accurately.",
        "Reach at least 10 saved matches in the selected range.",
        "Return to Analysis and review the first supported pattern."
      ],
      target: "Save {needed} more complete matches in this range."
    },
    headNoSignal: {
      title: "Keep collecting complete match data",
      meaning: "No single weakness is frequent and costly enough to justify changing practice yet.",
      proof: "The saved matches do not contain a recommendation with enough repeatable evidence.",
      steps: [
        "Keep the current strategy stable for the next practice set.",
        "Save every match rather than only the best or worst ones.",
        "Check that autonomous, pins, Toggle ownership, and Midfield are recorded.",
        "Review failures by action after practice.",
        "Return when another five complete matches are available."
      ],
      target: "Save five more complete matches before changing the practice plan."
    },
    skillsBalance: {
      title: "We do not have enough Skills data yet",
      meaning: "A useful Skills recommendation needs at least five Driver runs and five Autonomous Coding runs.",
      proof: "Saved so far: {driverCount} Driver runs and {autonCount} Autonomous Coding runs.",
      steps: [
        "Keep the current routes unchanged while creating a baseline.",
        "Record at least five complete Driver runs.",
        "Record at least five complete Autonomous Coding runs.",
        "Save every attempt, including low scores and failures.",
        "Return to Analysis after both sets are complete."
      ],
      target: "Save five valid runs of each Skills type."
    },
    skillsDriverRepeat: {
      title: "Increase Driver Skills practice and consistency",
      meaning: "Your best Driver score shows what the route can do, but most attempts are not reaching it yet.",
      proof: "Your best Driver score is {best}; your typical score is {median}, a {gap}-point gap.",
      steps: [
        "Divide the one-minute route into three timed checkpoints.",
        "Run the same route five times without improvising.",
        "Mark the first checkpoint that falls behind or fails.",
        "Practice that section alone, then reconnect it to the full route.",
        "Change the route only after the current version becomes repeatable."
      ],
      target: "Put at least 4 of 5 Driver runs within 10% of your current best score."
    },
    skillsAutonRepeat: {
      title: "Make your Autonomous Skills code more reliable",
      meaning: "The code has achieved a strong score, but it does not repeat that score often enough.",
      proof: "Your best Autonomous score is {best}; your typical score is {median}, a {gap}-point gap.",
      steps: [
        "Freeze the current route and run the code five times.",
        "Log the first failed programmed action in every run.",
        "Fix the most common failure before adding another action.",
        "Test normal variation in starting position, battery state, and field setup.",
        "Run the full code again after every local fix."
      ],
      target: "Put at least 4 of 5 Autonomous Coding runs within 10% of your current best score."
    },
    skillsRouteGain: {
      title: "Practice {route} more often",
      meaning: "Your {route} best score is much higher than a normal attempt, so repeatability is the quickest available gain.",
      proof: "Its best score is {best}, while its typical score is {median}; {gap} points are currently within reach.",
      steps: [
        "Compare the route's typical score with its best score.",
        "Identify which already-successful actions disappear in normal runs.",
        "Recover those proven actions before making the route longer.",
        "Practice the weakest checkpoint by itself.",
        "Confirm the improvement in a five-run set."
      ],
      target: "Recover at least half of the gap between the route's typical and best scores."
    },
    skillsYellow: {
      title: "Score more of the yellow pins you place",
      meaning: "Placed yellow pins are not consistently ending with the Toggle or Midfield ownership needed to score.",
      proof: "{scored} of {placed} placed yellow pins scored ({rate}), leaving about {missedPoints} points per run available.",
      steps: [
        "Find the quadrant losing the most yellow points.",
        "Treat placement and ownership as one complete scoring action.",
        "Add a route checkpoint that verifies the correct Toggle state.",
        "Test the route after deliberately resetting that Toggle incorrectly.",
        "End every run by scoring ownership, not placement alone."
      ],
      target: "Score at least 90% of placed yellow pins in five consecutive runs."
    },
    skillsCenter: {
      title: "Complete the Midfield objective more often",
      meaning: "Too many Skills attempts finish without completing the planned Midfield scoring action.",
      proof: "The Midfield finish was completed in {completeCount} of {count} runs ({rate}).",
      steps: [
        "Choose the exact point in the route when Midfield becomes the priority.",
        "Practice the entry from the route's real preceding position.",
        "Leave a time buffer instead of relying on a final-second arrival.",
        "Score the robot and center yellow pins only when the full condition is met.",
        "Shorten the earlier route if the Midfield finish remains unreliable."
      ],
      target: "Complete the planned Midfield finish in at least 8 of 10 runs."
    },
    skillsPlacement: {
      title: "Stop placing {color} pins where they cannot score",
      meaning: "The {zone} quadrant does not score those {color} pins, so that part of the route uses time without adding points.",
      proof: "{pins} {color} pins were placed there in this range, averaging {missedPoints} unavailable points per run.",
      steps: [
        "Remove the highest-cost wrong-zone placement from the route.",
        "Redirect that pin to the nearest scoring quadrant or leave it out.",
        "Practice the corrected travel path five times.",
        "Confirm that the shorter or redirected path produces a net score gain.",
        "Correct the next wrong-zone placement only after the first change works."
      ],
      target: "Finish at least 95% of red and blue pins in quadrants where they can score."
    },
    skillsEventSet: {
      title: "Prepare for all three official Skills attempts",
      meaning: "One attempt is strong, but the next-best attempt is too far behind to make a three-attempt event reliable.",
      proof: "Your best {route} run is {best}; your second-best is {second}, a {gap}-point drop.",
      steps: [
        "Simulate exactly three {route} runs.",
        "Do not restart failed attempts.",
        "Use the same repair and reset time you expect at an event.",
        "Record the best, second-best, and worst score in each set.",
        "Repeat sets until one bad attempt no longer defines the session."
      ],
      target: "In three consecutive sets, produce at least two runs within 10% of the route's best."
    },
    skillsCeiling: {
      title: "Add one scoring action to your stable {route} route",
      meaning: "Your {route} route is repeatable enough to test one small scoring addition without rebuilding it.",
      proof: "Your typical {route} score is {median} and your best is {best}; reliability is already strong.",
      steps: [
        "Protect the current reliable route as the baseline.",
        "Add one scoring action at the lowest-risk point.",
        "Test the new route five times against five baseline runs.",
        "Keep the addition only if the typical score rises without a sharp drop in the low runs.",
        "Remove it if the extra points appear only once."
      ],
      target: "Raise the route's typical score to {target} while keeping 4 of 5 runs within 10% of the new best."
    },
    skillsNoSignal: {
      title: "Keep recording complete Skills attempts",
      meaning: "The saved attempts do not show one repeatable weakness strongly enough to change the route yet.",
      proof: "More complete Driver and Autonomous attempts will make the next recommendation more specific.",
      steps: [
        "Keep both current routes unchanged for the next practice set.",
        "Save every complete attempt, including failures.",
        "Record pin placement, Toggle states, and the Midfield result accurately.",
        "Review the first failed action after each attempt.",
        "Return after five more complete attempts."
      ],
      target: "Save five more complete Skills attempts before changing the route."
    }
  },
  es: {},
  "zh-CN": {}
};

Object.assign(coachGuides.es, {
  headAutonCode: { title: "Mejora tu código autónomo", meaning: "El resultado autónomo es irregular y todavía no ofrece un inicio confiable.", proof: "Autónomo ganó o empató {successCount} de {count} partidos ({rate}).", steps: ["Mantén el código en su valor actual sin añadir otra acción.", "Ejecútalo 10 veces desde la misma posición inicial legal.", "Anota la primera acción que falla: localización, alineación, recogida, colocación o tiempo.", "Corrige la falla más común y repite con variaciones normales de batería y campo.", "Añade complejidad solo después de completar bien 8 de 10 intentos."], target: "Gana o empata autónomo en al menos 8 de 10 partidos de práctica." },
  headHoldAuton: { title: "Mantén tu ventaja autónoma", meaning: "La alianza suele ganar autónomo, pero pierde esa ventaja durante Driver Control.", proof: "Convertiste {converted} de {autonWins} victorias autónomas en victorias del partido ({rate}).", steps: ["Revisa los partidos donde ganaste autónomo pero perdiste el partido.", "Marca dónde desapareció la ventaja: ritmo, amarillos, Midfield o una tarea incompleta.", "Asigna el primer trabajo de cada robot antes del partido.", "Practica partidos que comiencen con 12 puntos de ventaja sin dejar de anotar.", "Comprueba si la alianza conserva la ventaja a mitad del partido y al final."], target: "Convierte al menos 7 de las próximas 10 victorias autónomas en victorias del partido." },
  headMidfield: { title: "Incluye el control de Midfield en tu plan", meaning: "Tus partidos terminan mejor con control de Midfield, pero aún no lo consigues de forma confiable.", proof: "El margen final fue {swing} puntos mejor con control de Midfield; lo controlaste en {rate} de los partidos.", steps: ["Decide antes de cada partido qué robot entrará a Midfield y cuál será el respaldo.", "Usa una llamada constante antes de los últimos 10 segundos.", "Practica la entrada desde varias posiciones reales, incluida una ruta bloqueada.", "Ensaya cuándo enviar uno, ambos o proteger puntos ya asegurados.", "Puntúa el ejercicio después de revisar robots y amarillos de Midfield."], target: "Consigue el resultado de Midfield planeado en al menos 8 de 10 partidos de práctica." },
  headYellow: { title: "Haz que puntúen más pines amarillos", meaning: "Se colocan amarillos, pero demasiados terminan en cuadrantes que tu alianza no posee.", proof: "Puntuaron {scored} de {placed} amarillos colocados ({rate}); quedaron disponibles unos {missedPoints} puntos por partido.", steps: ["Encuentra el cuadrante que pierde más valor amarillo.", "Decide si se protege, se recupera al final o se elimina de la ruta.", "Usa una llamada cuando haya un amarillo colocado sin Toggle asegurado.", "Practica colocar el amarillo y terminar con el Toggle correcto como una sola acción.", "Termina cada ejercicio comprobando propiedad, no solo colocación."], target: "Haz puntuar al menos el 85% de los amarillos colocados durante 10 partidos seguidos." },
  headToggleZone: { title: "Asegura el Toggle de {zone}", meaning: "El cuadrante {zone} es donde quedan más amarillos colocados sin propiedad.", proof: "Ese cuadrante contiene {missedPins} amarillos perdidos y promedia {missedPoints} puntos disponibles por partido.", steps: ["Empieza con amarillos ya colocados en el cuadrante {zone}.", "Asigna a un robot la revisión y control de ese Toggle.", "Practica la aproximación desde las dos posiciones más comunes.", "Repite con el Toggle neutral y en poder del rival.", "Comprueba al final si todos los amarillos realmente puntuaron."], target: "Posee el Toggle de {zone} en al menos 8 de 10 ejercicios cuando haya valor amarillo allí." },
  headEndgame: { title: "Ejecuta el Endgame con más consistencia", meaning: "La alianza llega a veces a los segundos finales sin completar el resultado de Midfield que eligió.", proof: "Ningún robot de la alianza terminó en Midfield en {missedMatches} partidos, incluidos {closeLosses} perdidos por 16 puntos o menos.", steps: ["Elige el objetivo de Endgame antes del partido; no todos necesitan el mismo plan.", "Asigna un robot principal y uno de respaldo.", "Usa la misma llamada de tiempo antes de los últimos 10 segundos.", "Practica desde posiciones libres, bloqueadas y del lado incorrecto.", "Evalúa si se ejecutó el plan elegido, no si ambos robots entraron siempre."], target: "Ejecuta el plan de Endgame elegido en al menos 8 de 10 partidos de práctica." },
  headPins: { title: "Anota más pines rojos y azules", meaning: "El control es razonablemente estable, pero tus victorias contienen más pines del color de la alianza.", proof: "Las victorias promediaron {winningPins} pines de alianza y las derrotas {losingPins}; diferencia de {pinGap}.", steps: ["Haz un ejercicio de 30 segundos para anotar pines.", "Cuenta acciones completas y localiza dónde se pierde tiempo.", "Elimina una demora repetida de recogida, alineación, recorrido o colocación.", "Prueba la acción más rápida en un partido completo sin sacrificar amarillos ni Endgame.", "Conserva el cambio solo si el puntaje total sube de forma constante."], target: "Iguala los pines de alianza de tus victorias en al menos 8 de 10 partidos de práctica." },
  headNeedData: { title: "Guarda más partidos antes de elegir un enfoque", meaning: "Todavía no hay evidencia suficiente para recomendar un cambio de estrategia.", proof: "Hay {count} partidos guardados en este rango; se necesitan al menos 10.", steps: ["Mantén el plan actual mientras creas una referencia.", "Guarda todos los partidos, incluidas derrotas y resultados inusuales.", "Registra bien autónomo, Toggles, pines y Midfield.", "Llega a 10 partidos guardados en el rango.", "Vuelve a Analysis para revisar el primer patrón respaldado."], target: "Guarda {needed} partidos completos más en este rango." },
  headNoSignal: { title: "Sigue guardando datos completos de partidos", meaning: "Ninguna debilidad es todavía lo bastante frecuente y costosa para cambiar la práctica.", proof: "Los partidos guardados no muestran una recomendación con evidencia repetible suficiente.", steps: ["Mantén estable la estrategia durante la próxima serie.", "Guarda todos los partidos, no solo los mejores o peores.", "Comprueba que autónomo, pines, Toggles y Midfield estén registrados.", "Después de practicar, revisa las fallas por acción.", "Vuelve cuando haya cinco partidos completos más."], target: "Guarda cinco partidos completos más antes de cambiar el plan de práctica." },
  skillsBalance: { title: "Todavía no tenemos suficientes datos de Skills", meaning: "Una recomendación útil necesita cinco intentos Driver y cinco de Código Autónomo.", proof: "Guardados: {driverCount} Driver y {autonCount} de Código Autónomo.", steps: ["Mantén las rutas actuales mientras creas la referencia.", "Guarda cinco intentos Driver completos.", "Guarda cinco intentos de Código Autónomo completos.", "Guarda todos los intentos, incluso fallas y puntajes bajos.", "Vuelve a Analysis cuando ambos grupos estén completos."], target: "Guarda cinco intentos válidos de cada tipo de Skills." },
  skillsDriverRepeat: { title: "Aumenta la práctica y consistencia de Driver Skills", meaning: "Tu mejor puntaje muestra lo que la ruta puede hacer, pero la mayoría de intentos aún no lo alcanzan.", proof: "Tu mejor Driver es {best}; el puntaje típico es {median}, una diferencia de {gap}.", steps: ["Divide la ruta de un minuto en tres controles de tiempo.", "Haz la misma ruta cinco veces sin improvisar.", "Marca el primer control que se atrasa o falla.", "Practica esa sección sola y vuelve a unirla.", "Cambia la ruta solo cuando la actual sea repetible."], target: "Logra que al menos 4 de 5 Driver queden dentro del 10% de tu mejor puntaje." },
  skillsAutonRepeat: { title: "Haz más confiable tu código de Autonomous Skills", meaning: "El código ya logró un buen puntaje, pero todavía no lo repite con suficiente frecuencia.", proof: "Tu mejor Autónomo es {best}; el puntaje típico es {median}, una diferencia de {gap}.", steps: ["Congela la ruta actual y ejecuta el código cinco veces.", "Anota la primera acción programada que falla.", "Corrige la falla más común antes de añadir otra acción.", "Prueba variaciones normales de posición, batería y campo.", "Ejecuta el código completo después de cada corrección."], target: "Logra que al menos 4 de 5 Autónomos queden dentro del 10% de tu mejor puntaje." },
  skillsRouteGain: { title: "Practica {route} con más frecuencia", meaning: "El mejor puntaje de {route} supera mucho un intento normal, así que repetir lo que ya funciona es la mejora más cercana.", proof: "Su mejor puntaje es {best} y el típico {median}; hay {gap} puntos alcanzables.", steps: ["Compara el puntaje típico con el mejor.", "Identifica qué acciones ya logradas desaparecen en intentos normales.", "Recupera esos puntos antes de alargar la ruta.", "Practica por separado el control más débil.", "Confirma la mejora en cinco intentos."], target: "Recupera al menos la mitad de la diferencia entre el puntaje típico y el mejor." },
  skillsYellow: { title: "Haz puntuar más amarillos de los que colocas", meaning: "Los amarillos colocados no terminan siempre con la propiedad necesaria.", proof: "Puntuaron {scored} de {placed} amarillos ({rate}); quedaron unos {missedPoints} puntos por intento.", steps: ["Encuentra el cuadrante que pierde más puntos amarillos.", "Trata colocación y propiedad como una sola acción.", "Añade un control de ruta para verificar el Toggle.", "Prueba la ruta con el Toggle colocado mal a propósito.", "Puntúa propiedad al final, no solo colocación."], target: "Haz puntuar al menos el 90% de los amarillos en cinco intentos seguidos." },
  skillsCenter: { title: "Completa el objetivo de Midfield con más frecuencia", meaning: "Demasiados intentos terminan sin completar la acción de puntuación planeada en Midfield.", proof: "Completaste Midfield en {completeCount} de {count} intentos ({rate}).", steps: ["Elige el momento exacto en que Midfield se vuelve prioridad.", "Practica la entrada desde la posición real anterior.", "Deja margen de tiempo y no dependas del último segundo.", "Cuenta robot y amarillos solo cuando se cumpla toda la condición.", "Acorta la ruta anterior si el final sigue siendo irregular."], target: "Completa el final de Midfield en al menos 8 de 10 intentos." },
  skillsPlacement: { title: "Deja de colocar pines {color} donde no puntúan", meaning: "El cuadrante {zone} no puntúa esos pines {color}, así que esa parte de la ruta usa tiempo sin sumar puntos.", proof: "Se colocaron allí {pins} pines {color}, un promedio de {missedPoints} puntos no disponibles por intento.", steps: ["Elimina la colocación incorrecta de mayor costo.", "Redirige el pin al cuadrante válido más cercano o déjalo fuera.", "Practica el recorrido corregido cinco veces.", "Confirma que el cambio produce una ganancia neta.", "Corrige la siguiente colocación solo después de que funcione la primera."], target: "Termina al menos el 95% de pines rojos y azules en cuadrantes donde puedan puntuar." },
  skillsEventSet: { title: "Prepárate para los tres intentos oficiales de Skills", meaning: "Un intento es fuerte, pero el segundo mejor está demasiado lejos para confiar en las tres oportunidades del evento.", proof: "Tu mejor {route} es {best}; el segundo es {second}, una caída de {gap}.", steps: ["Simula exactamente tres intentos de {route}.", "No reinicies los intentos fallidos.", "Usa el mismo tiempo de reparación y reinicio esperado en un evento.", "Guarda el mejor, segundo y peor puntaje.", "Repite hasta que una falla no defina la sesión."], target: "En tres series seguidas, logra dos intentos dentro del 10% del mejor de la ruta." },
  skillsCeiling: { title: "Añade una acción de puntuación a tu ruta estable de {route}", meaning: "La ruta ya es repetible y puede probar una pequeña adición sin reconstruirla.", proof: "Tu puntaje típico de {route} es {median} y el mejor {best}; la fiabilidad ya es fuerte.", steps: ["Protege la ruta confiable como referencia.", "Añade una acción en el punto de menor riesgo.", "Compara cinco rutas nuevas con cinco de referencia.", "Conserva la acción solo si sube el típico sin hundir los intentos bajos.", "Quítala si los puntos extra aparecen una sola vez."], target: "Sube el puntaje típico a {target} y mantén 4 de 5 intentos dentro del 10% del nuevo mejor." },
  skillsNoSignal: { title: "Sigue guardando intentos completos de Skills", meaning: "Los intentos guardados no muestran una debilidad repetible suficiente para cambiar la ruta.", proof: "Más intentos completos de Driver y Autónomo permitirán una recomendación específica.", steps: ["Mantén ambas rutas sin cambios durante la próxima serie.", "Guarda cada intento completo, incluidas las fallas.", "Registra bien pines, Toggles y Midfield.", "Revisa la primera acción fallida después de cada intento.", "Vuelve después de cinco intentos completos más."], target: "Guarda cinco intentos completos más antes de cambiar la ruta." }
});

Object.assign(coachGuides["zh-CN"], {
  headAutonCode: { title: "改进自动代码", meaning: "自动结果不稳定，开局得分还不可靠。", proof: "{count} 场中自动获胜或打平 {successCount} 场（{rate}）。", steps: ["先固定当前代码，不要继续增加动作。", "从同一合法起点连续运行 10 次。", "记录每次最先失败的动作：定位、对准、拾取、放置或时序。", "修复最常见的失败，再加入正常电量和场地误差测试。", "至少 10 次成功 8 次后再增加复杂度。"], target: "在 10 场练习赛中至少 8 场赢下或打平自动。" },
  headHoldAuton: { title: "把自动优势保持到比赛结束", meaning: "联盟经常赢下自动，但进入驾驶阶段后把领先交了回去。", proof: "{autonWins} 次自动获胜中有 {converted} 次转化为比赛胜利（{rate}）。", steps: ["复盘赢下自动却输掉比赛的记录。", "标出领先从哪里消失：得分速度、黄桩归属、Midfield 或未完成任务。", "赛前明确两台联盟机器人的第一个驾驶任务。", "从领先 12 分开始打练习赛，并在继续得分的同时守住优势。", "在比赛中段和终场都检查是否仍然领先。"], target: "接下来 10 次自动获胜中至少 7 次转化为比赛胜利。" },
  headMidfield: { title: "把 Midfield 控制写进比赛计划", meaning: "控制 Midfield 时比赛结果更好，但目前还不够稳定。", proof: "控制 Midfield 时最终分差平均好 {swing} 分；控制率为 {rate}。", steps: ["赛前确定负责进入 Midfield 的机器人和备用机器人。", "在最后 10 秒前使用固定的驾驶队口令。", "从多个真实位置练习进入，包括直接路线被挡住时。", "练习选择一台进入、两台进入或保护已有得分。", "检查机器人数量和 Midfield 黄桩归属后再给练习计分。"], target: "10 场练习赛中至少 8 场完成计划中的 Midfield 结果。" },
  headYellow: { title: "让更多已放置黄桩真正得分", meaning: "黄桩已经放置，但太多位于联盟最终没有控制的区域。", proof: "{placed} 个已放置黄桩中有 {scored} 个得分（{rate}），每场约有 {missedPoints} 分未拿到。", steps: ["找出损失黄桩价值最多的区域。", "决定该区域要保护、终场夺回，还是从路线中移除。", "黄桩已放置但 Toggle 未锁定时使用统一口令。", "把放黄桩和最终正确 Toggle 状态作为一个完整动作练习。", "每次练习最后检查归属，而不只是放置。"], target: "连续 10 场练习赛让至少 85% 的已放置黄桩得分。" },
  headToggleZone: { title: "锁定{zone}区域的 Toggle", meaning: "{zone}区域最常出现黄桩已放置但联盟没有归属的情况。", proof: "该区域本时段共有 {missedPins} 个未得分黄桩，平均每场约 {missedPoints} 分。", steps: ["练习开始时先在{zone}区域放好黄桩。", "指定一台机器人在终场前检查并锁定该 Toggle。", "从两个最常见的位置练习接近。", "分别从中立和对手控制状态开始练习。", "最后确认该区域每个黄桩是否真正得分。"], target: "当该区域有黄桩价值时，10 次练习至少 8 次控制{zone} Toggle。" },
  headEndgame: { title: "更稳定地执行 Endgame", meaning: "联盟有时进入最后阶段却没有完成赛前选择的 Midfield 结果。", proof: "{missedMatches} 场没有联盟机器人进入 Midfield，其中 {closeLosses} 场以不超过 16 分落败。", steps: ["赛前选择本场 Endgame 目标，不假设每场都用同一计划。", "指定主执行机器人和备用机器人。", "最后 10 秒前使用相同的时间口令。", "从畅通、受阻和错误侧位置练习。", "按是否完成所选计划评价，而不是强求两台机器人都进入。"], target: "10 场练习赛中至少 8 场完成所选 Endgame 计划。" },
  headPins: { title: "得到更多红色和蓝色桩分", meaning: "控制表现已经较稳定，但获胜场次的联盟色桩明显更多。", proof: "胜场平均 {winningPins} 个联盟色桩，负场平均 {losingPins} 个，相差 {pinGap} 个。", steps: ["进行 30 秒限时桩得分练习。", "统计完整得分动作并找出时间损失。", "消除拾取、对准、移动或放置中的一个重复延迟。", "在完整比赛中测试更快动作，同时保持黄桩和 Endgame。", "只有总分稳定提高时才保留改变。"], target: "10 场练习赛中至少 8 场达到胜场的联盟色桩数量。" },
  headNeedData: { title: "先保存更多比赛再选择训练重点", meaning: "目前证据不足，不能可靠地建议改变比赛策略。", proof: "此范围内已保存 {count} 场；至少需要 10 场。", steps: ["建立基准期间保持当前比赛计划。", "保存每场练习赛，包括失利和异常结果。", "准确记录自动、Toggle、桩和 Midfield。", "在所选范围内达到至少 10 场。", "回到分析查看第一个有证据支持的模式。"], target: "在此范围内再保存 {needed} 场完整比赛。" },
  headNoSignal: { title: "继续保存完整的比赛数据", meaning: "目前没有一个弱点既频繁又代价足够高，值得改变训练。", proof: "已保存比赛中还没有足够可重复证据支持单一建议。", steps: ["下一组练习继续使用当前策略。", "保存所有比赛，不只保存最好或最差的。", "确认记录自动、桩、Toggle 和 Midfield。", "练习后按动作复盘失败。", "再有五场完整比赛后回来查看。"], target: "改变训练计划前再保存五场完整比赛。" },
  skillsBalance: { title: "Skills 数据还不够", meaning: "可靠建议至少需要 5 次 Driver 和 5 次自动编程记录。", proof: "目前已保存：Driver {driverCount} 次，自动编程 {autonCount} 次。", steps: ["建立基准期间先保持当前路线。", "保存至少 5 次完整 Driver。", "保存至少 5 次完整自动编程。", "每次都保存，包括低分和失败。", "两组完成后再回到分析。"], target: "每种 Skills 类型保存 5 次有效记录。" },
  skillsDriverRepeat: { title: "增加 Driver Skills 练习并提高稳定性", meaning: "最佳成绩说明路线有能力得分，但大多数尝试还没有达到它。", proof: "Driver 最佳 {best}，典型成绩 {median}，相差 {gap} 分。", steps: ["把一分钟路线分成三个计时检查点。", "不临时改变路线，连续运行五次。", "标记最先落后或失败的检查点。", "单独练习该段，再接回完整路线。", "当前路线稳定后再更改路线。"], target: "5 次 Driver 中至少 4 次达到最佳成绩的 90%。" },
  skillsAutonRepeat: { title: "提高自动 Skills 代码的可靠性", meaning: "代码已经取得过好成绩，但还不能足够频繁地重复。", proof: "自动最佳 {best}，典型成绩 {median}，相差 {gap} 分。", steps: ["固定当前路线并运行代码五次。", "记录每次最先失败的编程动作。", "修复最常见失败后再增加动作。", "测试起点、电量和场地的正常误差。", "每次局部修复后重新运行完整代码。"], target: "5 次自动编程中至少 4 次达到最佳成绩的 90%。" },
  skillsRouteGain: { title: "增加{route}练习次数", meaning: "{route}最佳成绩明显高于普通尝试，先稳定已有动作是最近的提升。", proof: "最佳 {best}，典型成绩 {median}，已有 {gap} 分可以追回。", steps: ["比较路线的典型成绩和最佳成绩。", "找出普通运行中消失的已成功动作。", "先追回这些得分，再延长路线。", "单独练习最弱检查点。", "用五次完整运行确认提升。"], target: "至少追回典型成绩与最佳成绩差距的一半。" },
  skillsYellow: { title: "让更多已放置黄桩得分", meaning: "黄桩已放置，但终场时没有稳定满足 Toggle 或 Midfield 归属。", proof: "{placed} 个已放置黄桩中有 {scored} 个得分（{rate}），每次约有 {missedPoints} 分未拿到。", steps: ["找出损失黄桩分最多的区域。", "把放置和归属当作一个完整得分动作。", "在路线中加入 Toggle 状态检查点。", "故意把 Toggle 重置错误后测试路线。", "每次最后按归属计分，而不是只看放置。"], target: "连续五次让至少 90% 的已放置黄桩得分。" },
  skillsCenter: { title: "更频繁地完成 Midfield 目标", meaning: "太多尝试结束时没有完成计划中的 Midfield 得分动作。", proof: "{count} 次中有 {completeCount} 次完成 Midfield（{rate}）。", steps: ["确定路线中开始优先 Midfield 的准确时间。", "从路线真实的前一个位置练习进入。", "预留时间，不依赖最后一秒。", "只有完整满足条件时才计算机器人和中心黄桩。", "如果仍不稳定，就缩短前面的路线。"], target: "10 次中至少 8 次完成计划中的 Midfield 终点。" },
  skillsPlacement: { title: "不要把{color}桩放在不能得分的位置", meaning: "{zone}区域不能让这些{color}桩得分，这段路线耗时却不加分。", proof: "本时段有 {pins} 个{color}桩放在这里，平均每次约 {missedPoints} 分无效。", steps: ["先删除代价最高的错误区域放置。", "把桩送到最近的有效区域，或不做该动作。", "练习修正后的路线五次。", "确认更短或改向后的路线带来净得分。", "第一处修正稳定后再处理下一处。"], target: "至少 95% 的红蓝桩最终位于可以得分的区域。" },
  skillsEventSet: { title: "为三次正式 Skills 尝试做好准备", meaning: "一次尝试很强，但第二高分落后太多，三次比赛机会还不可靠。", proof: "{route}最佳 {best}，第二高 {second}，下降 {gap} 分。", steps: ["准确模拟三次{route}运行。", "失败后不要重启。", "使用比赛中预期的维修和重置时间。", "记录每组最佳、第二和最低成绩。", "反复练习，直到一次失败不会毁掉整组。"], target: "连续三组中，每组至少两次达到该路线最佳成绩的 90%。" },
  skillsCeiling: { title: "给稳定的{route}路线增加一个得分动作", meaning: "路线已经足够稳定，可以测试一个小的得分动作而不必重做路线。", proof: "{route}典型成绩 {median}，最佳 {best}；稳定性已经足够。", steps: ["把当前稳定路线保留为基准。", "在风险最低的位置增加一个得分动作。", "用五次新路线对比五次基准路线。", "只有典型成绩提高且低分没有明显下降时才保留。", "如果额外得分只出现一次，就删除该动作。"], target: "把典型成绩提高到 {target}，并让 5 次中至少 4 次达到新最佳的 90%。" },
  skillsNoSignal: { title: "继续保存完整的 Skills 尝试", meaning: "已保存尝试还没有显示出足够稳定的单一弱点来改变路线。", proof: "更多完整 Driver 和自动尝试会让下一条建议更具体。", steps: ["下一组练习保持两条路线不变。", "保存每次完整尝试，包括失败。", "准确记录桩、Toggle 和 Midfield。", "每次尝试后复盘第一个失败动作。", "再完成五次后回到分析。"], target: "改变路线前再保存五次完整 Skills 尝试。" }
});

let currentLanguage = readLanguage();
const initialProxyParam = new URLSearchParams(window.location.search).get("proxy");
if (initialProxyParam) {
  localStorage.setItem(PROXY_URL_STORE_KEY, initialProxyParam.trim().replace(/\/$/, ""));
}

function readLanguage() {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORE_KEY);
    return supportedLanguages.includes(stored) ? stored : "en";
  } catch {
    return "en";
  }
}

function languageLocale() {
  return languageLocales[currentLanguage] || languageLocales.en;
}

function t(key, params = {}) {
  const dictionary = translations[currentLanguage] || translations.en;
  const template = dictionary[key] ?? translations.en[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
}

function tt(key, fallback, params = {}) {
  const dictionary = translations[currentLanguage] || translations.en;
  const template = dictionary[key] ?? translations.en[key];
  if (!template) return fallback;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
}

function countKey(base, count) {
  return `${base}.${Number(count) === 1 ? "one" : "many"}`;
}

function countText(base, count) {
  return t(countKey(base, count), { count });
}

function applyI18n() {
  document.documentElement.lang = currentLanguage;
  $$("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  $$("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  });
  $$("[data-i18n-aria]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
  });
  const languageSelect = $("[data-language-select]");
  if (languageSelect) languageSelect.value = currentLanguage;
}

function setLanguage(language) {
  currentLanguage = supportedLanguages.includes(language) ? language : "en";
  localStorage.setItem(LANGUAGE_STORE_KEY, currentLanguage);
  applyI18n();
  buildCounters();
  renderMode();
  render();
  renderSkills();
  renderHistory();
  renderSkillsHistory();
  renderCompetitionPickers(syncedEvents);
  renderCompetitionSource();
  renderMyCompetitions();
  renderCompetitionFilters();
  renderCompetitionResults(competitionSearchResults);
  renderTeamSkillsResults(teamSkillsResults);
  renderJudgeTeamIdentity();
  renderJudgeOfficialSkillsState();
  renderAnalysis();
  renderImportedCompetition();
}

function vexProxyUrl() {
  return (window.VEX_OVERRIDE_PROXY_URL || localStorage.getItem(PROXY_URL_STORE_KEY) || DEFAULT_VEX_PROXY_URL).trim().replace(/\/$/, "");
}

function buildCounters() {
  quadrants.forEach((quadrant) => {
    const wrap = $(`[data-quadrant="${quadrant}"]`);
    wrap.innerHTML = colors.map(color => `
      <div class="counter ${color}" data-counter="${quadrant}:${color}">
        <button type="button" data-step="${quadrant}:${color}:-1" aria-label="${escapeHtml(t("aria.decreasePins", { color: t(`color.${color}`), quadrant: t(`quadrant.${quadrant}`) }))}">-</button>
        <output aria-label="${escapeHtml(t("aria.pinsInQuadrant", { color: t(`color.${color}`), quadrant: t(`quadrant.${quadrant}`) }))}">0</output>
        <button type="button" data-step="${quadrant}:${color}:1" aria-label="${escapeHtml(t("aria.increasePins", { color: t(`color.${color}`), quadrant: t(`quadrant.${quadrant}`) }))}">+</button>
      </div>
    `).join("");
  });
}

function setAuton(next) {
  if (state.auton === next) {
    state.auton = "none";
  } else if ((state.auton === "red" && next === "blue") || (state.auton === "blue" && next === "red")) {
    state.auton = "tie";
  } else if (state.auton === "tie") {
    state.auton = next;
  } else {
    state.auton = next;
  }
  render();
}

function cycleToggle(quadrant) {
  if (quadrant === "center") return;
  const current = state.quadrants[quadrant].toggle;
  const index = toggleStates.indexOf(current);
  state.quadrants[quadrant].toggle = toggleStates[(index + 1) % toggleStates.length];
  render();
}

function stepCounter(quadrant, color, amount) {
  const current = state.quadrants[quadrant][color];
  state.quadrants[quadrant][color] = Math.max(0, current + amount);
  render();
}

function toggleRobot(robotId) {
  state.robots[robotId] = !state.robots[robotId];
  render();
}

function stepSkillsCounter(quadrant, color, amount) {
  if (!skillsState.quadrants[quadrant] || !Object.hasOwn(skillsState.quadrants[quadrant], color)) return;
  const current = skillsState.quadrants[quadrant][color];
  skillsState.quadrants[quadrant][color] = Math.max(0, current + amount);
  renderSkills();
}

function toggleSkillsCenter() {
  skillsState.centerToggle = !skillsState.centerToggle;
  renderSkills();
}

function cycleSkillsToggle(quadrant) {
  if (!Object.hasOwn(skillsState.toggles, quadrant)) return;
  const index = toggleStates.indexOf(skillsState.toggles[quadrant]);
  skillsState.toggles[quadrant] = toggleStates[(index + 1) % toggleStates.length];
  renderSkills();
}

function scoreSkills() {
  const q = skillsState.quadrants;
  let score = 0;

  score += (q.left.red + q.bottom.red + q.center.red) * POINTS.alliancePin;
  score += (q.top.blue + q.right.blue + q.center.blue) * POINTS.alliancePin;

  if (skillsState.toggles.left === "red") score += q.left.yellow * POINTS.yellowPin;
  if (skillsState.toggles.bottom === "red") score += q.bottom.yellow * POINTS.yellowPin;
  if (skillsState.toggles.top === "blue") score += q.top.yellow * POINTS.yellowPin;
  if (skillsState.toggles.right === "blue") score += q.right.yellow * POINTS.yellowPin;

  if (skillsState.centerToggle) {
    score += POINTS.midfieldRobot;
    score += q.center.yellow * POINTS.yellowPin;
  }

  return score;
}

function setSkillsRunType(type) {
  skillsRunType = skillsRunType === type ? "none" : type;
  renderSkills();
}

function scoreAlliance(alliance) {
  let score = 0;
  const centerOwner = midfieldOwner();

  if (state.auton === alliance) score += POINTS.auton;
  if (state.auton === "tie") score += POINTS.autonTie;

  quadrants.forEach((quadrant) => {
    const q = state.quadrants[quadrant];
    score += q[alliance] * POINTS.alliancePin;
    const owner = quadrant === "center" ? centerOwner : q.toggle;
    if (owner === alliance) score += q.yellow * POINTS.yellowPin;
  });

  Object.entries(state.robots).forEach(([robotId, active]) => {
    if (active && robotId.startsWith(alliance)) score += POINTS.midfieldRobot;
  });

  return score;
}

function midfieldOwner() {
  const red = Number(state.robots["red-1"]) + Number(state.robots["red-2"]);
  const blue = Number(state.robots["blue-1"]) + Number(state.robots["blue-2"]);
  if (red > blue) return "red";
  if (blue > red) return "blue";
  return "neutral";
}

function autonText() {
  if (state.auton === "red") return "Red autonomous bonus: +12 red.";
  if (state.auton === "blue") return "Blue autonomous bonus: +12 blue.";
  if (state.auton === "tie") return "Autonomous tied: +6 red, +6 blue.";
  return "No autonomous bonus selected.";
}

function activeMatchStoreKey() {
  return isJudgeMode ? JUDGE_MATCH_STORE_KEY : MATCH_STORE_KEY;
}

function activeProfileStoreKey() {
  return isJudgeMode ? JUDGE_PROFILE_STORE_KEY : PROFILE_STORE_KEY;
}

function activeCompetitionStoreKey() {
  return isJudgeMode ? JUDGE_COMPETITION_STORE_KEY : COMPETITION_STORE_KEY;
}

function savedMatches() {
  try {
    const matches = JSON.parse(localStorage.getItem(activeMatchStoreKey()));
    return Array.isArray(matches) ? matches : [];
  } catch {
    return [];
  }
}

function writeSavedMatches(matches) {
  localStorage.setItem(activeMatchStoreKey(), JSON.stringify(matches));
}

function loadCompetitionData() {
  try {
    const saved = JSON.parse(localStorage.getItem(activeCompetitionStoreKey()));
    return saved && typeof saved === "object" ? saved : null;
  } catch {
    return null;
  }
}

function writeCompetitionData(competition) {
  localStorage.setItem(activeCompetitionStoreKey(), JSON.stringify(competition));
  importedCompetition = competition;
}

function matchRecordSummary(matches) {
  return matches.reduce((record, match) => {
    if (match.result === "win") record.wins += 1;
    if (match.result === "loss") record.losses += 1;
    if (match.result === "tie") record.ties += 1;
    return record;
  }, { wins: 0, losses: 0, ties: 0 });
}

function isHeadMatch(match) {
  return match?.mode !== "skills";
}

function isSkillsRun(match) {
  return match?.mode === "skills";
}

function renderBanner() {
  const team = $("[data-banner-team]");
  const count = $("[data-banner-matches]");
  const record = $("[data-banner-record]");
  const countLabel = $("[data-banner-matches-label]");
  const recordLabel = $("[data-banner-record-label]");
  if (!team || !count || !record) return;

  const matches = savedMatches().filter(isHeadMatch);
  const summary = matchRecordSummary(matches);
  team.textContent = profile?.teamName ? `${profile.teamNumber} ${profile.teamName}` : (profile?.teamNumber || "4330P");
  count.textContent = String(matches.length);
  record.textContent = `${summary.wins}-${summary.losses}-${summary.ties}`;
  if (countLabel) countLabel.textContent = t(isJudgeMode ? "judge.practiceMatches" : "banner.matches");
  if (recordLabel) recordLabel.textContent = t(isJudgeMode ? "judge.practiceRecord" : "banner.record");
}

function competitionLocation(event) {
  return [event.city, event.region, event.country].filter(Boolean).join(", ");
}

function officialEventRegionName(event) {
  return event?.eventRegionName || event?.meta?.eventRegion?.name || "";
}

function officialEventRegionId(event) {
  return event?.eventRegionId || event?.meta?.eventRegion?.id || "";
}

function competitionDateLabel(event) {
  const value = event.date || event.start;
  if (!value) return t("scouting.dateNotListed");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(languageLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function eventLocationFromData(event) {
  const data = event?.data || event || {};
  const location = data.location || {};
  return [location.city || data.city, location.region || data.region, location.country || data.country].filter(Boolean).join(", ");
}

function localEventId(event) {
  return String(event.eventId || event.id || "");
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[™®©★]/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function compactSearchText(value) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function searchTokens(value) {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

function searchTextMatches(haystack, query) {
  const normalizedHaystack = normalizeSearchText(haystack);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  if (normalizedHaystack.includes(normalizedQuery) || compactSearchText(haystack).includes(compactSearchText(query))) return true;
  const tokens = searchTokens(query);
  return tokens.length > 0 && tokens.every(token => normalizedHaystack.includes(token));
}

function regionAliases(label) {
  const normalized = normalizeSearchText(label);
  const aliases = new Set([label]);
  const regionMatch = normalized.match(/^([a-z ]+?) region ([0-9]+)$/);
  if (regionMatch) {
    aliases.add(`${regionMatch[1]} ${regionMatch[2]}`);
    aliases.add(`${regionMatch[1]} r${regionMatch[2]}`);
  }
  if (normalized === "florida south") {
    aliases.add("South Florida");
    aliases.add("Florida South");
    aliases.add("FL South");
    aliases.add("SFL");
  }
  if (normalized === "florida north central") {
    aliases.add("North Florida");
    aliases.add("Central Florida");
    aliases.add("Florida North");
    aliases.add("Florida Central");
    aliases.add("Florida North Central");
    aliases.add("North/Central Florida");
    aliases.add("North Central Florida");
    aliases.add("FL North Central");
    aliases.add("FNC");
  }
  if (normalized === "korea republic of") {
    aliases.add("South Korea");
    aliases.add("Korea");
  }
  if (normalized === "new york south") {
    aliases.add("South New York");
    aliases.add("Southern New York");
  }
  if (normalized === "new york north") aliases.add("North New York");
  return [...aliases];
}

function regionSearchText(label) {
  return regionAliases(label).join(" ");
}

function eventRegionKey(event) {
  const officialId = officialEventRegionId(event);
  if (officialId) return `official|${officialId}`;
  const officialName = officialEventRegionName(event);
  if (officialName) return `official-name|${normalizeSearchText(officialName)}`;
  return [event.region, event.country].filter(Boolean).join("|");
}

function eventRegionLabel(event) {
  const officialName = officialEventRegionName(event);
  if (officialName) return officialName;
  return [event.region, event.country].filter(Boolean).join(", ") || t("scouting.regionNotListed");
}

function eventDateTime(event) {
  const time = new Date(event.start || event.date || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isUpcomingEvent(event) {
  const time = eventDateTime(event);
  if (!time) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return time >= today.getTime();
}

function eventTeamIndexText(event) {
  if (!syncedTeamIndex) return "";
  return syncedTeamIndex.eventText.get(localEventId(event)) || "";
}

function localEventMatches(event, query, region = "") {
  if (region && eventRegionKey(event) !== region) return false;
  if (!query) return true;
  const haystack = [
    event.eventId,
    event.id,
    event.sku,
    event.code,
    event.name,
    event.start,
    event.end,
    event.city,
    event.region,
    officialEventRegionName(event),
    event.country,
    eventTeamIndexText(event)
  ].filter(Boolean).join(" ");
  return searchTextMatches(`${haystack} ${regionSearchText(officialEventRegionName(event))}`, query);
}

function eventMatchesQuickFilter(event) {
  if (competitionQuickFilter === "mine") return myCompetitionEvents().some(item => localEventId(item) === localEventId(event));
  if (competitionQuickFilter === "florida") return normalizeSearchText(event.region) === "florida" || normalizeSearchText(officialEventRegionName(event)).includes("florida");
  if (competitionQuickFilter === "usa") return normalizeSearchText(event.country) === "united states";
  if (competitionQuickFilter === "upcoming") return isUpcomingEvent(event);
  if (competitionQuickFilter === "past") return eventDateTime(event) > 0 && !isUpcomingEvent(event);
  return true;
}

function eventSearchRank(event, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return eventDateTime(event);
  const compactQuery = compactSearchText(query);
  const id = normalizeSearchText(localEventId(event));
  const sku = normalizeSearchText(event.sku || event.code || "");
  const teams = eventTeamIndexText(event);
  const city = normalizeSearchText(event.city);
  const region = normalizeSearchText(event.region);
  const officialRegion = normalizeSearchText(officialEventRegionName(event));
  const country = normalizeSearchText(event.country);
  const name = normalizeSearchText(event.name);
  let score = 0;
  if (id === normalizedQuery || sku === normalizedQuery || compactSearchText(event.sku || event.code || "") === compactQuery) score += 100000;
  if (teams.split(" ").includes(normalizedQuery) || compactSearchText(teams).includes(compactQuery)) score += 80000;
  if (city.includes(normalizedQuery)) score += 40000;
  if (searchTextMatches(regionSearchText(officialEventRegionName(event)), query)) score += 35000;
  if (region.includes(normalizedQuery)) score += 30000;
  if (country.includes(normalizedQuery)) score += 20000;
  if (name.includes(normalizedQuery)) score += 10000;
  score -= eventDateTime(event) / 10000000000000;
  return -score;
}

function sortedSyncedEvents(events = [], query = "") {
  return [...events].sort((a, b) => {
    if (query) return eventSearchRank(a, query) - eventSearchRank(b, query);
    const aTime = new Date(a.start || a.date || 0).getTime();
    const bTime = new Date(b.start || b.date || 0).getTime();
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) return aTime - bTime;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function competitionFilterValues() {
  const form = $("[data-competition-search-form]");
  if (!form) return { query: "", region: "", regionQuery: "" };
  const formData = new FormData(form);
  const typedRegion = currentRegionInputValue();
  return {
    query: String(formData.get("competitionSearch") || "").trim(),
    region: selectedCompetitionRegion,
    regionQuery: selectedCompetitionRegion ? "" : typedRegion
  };
}

function filteredSyncedEvents() {
  const { query, region, regionQuery } = competitionFilterValues();
  return sortedSyncedEvents(syncedEvents.filter(event =>
    eventMatchesQuickFilter(event) &&
    localEventMatches(event, query, region) &&
    eventMatchesRegionQuery(event, regionQuery)
  ), query);
}

function regionMatchRank(option, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  const compactQuery = compactSearchText(query);
  const tokens = searchTokens(query);
  let best = Infinity;

  regionAliases(option.label).forEach((value) => {
    const normalized = normalizeSearchText(value);
    const compact = compactSearchText(value);
    const words = normalized.split(" ").filter(Boolean);
    if (normalized === normalizedQuery || compact === compactQuery) best = Math.min(best, 0);
    else if (normalized.startsWith(normalizedQuery) || compact.startsWith(compactQuery)) best = Math.min(best, 1);
    else if (tokens.length && tokens.every(token => words.some(word => word.startsWith(token)))) best = Math.min(best, 2);
    else if (normalized.includes(normalizedQuery) || compact.includes(compactQuery)) best = Math.min(best, 3);
    else if (tokens.length && tokens.every(token => normalized.includes(token))) best = Math.min(best, 4);
  });

  return best;
}

function regionOptionMatches(option, query) {
  return Number.isFinite(regionMatchRank(option, query));
}

function currentRegionInputValue() {
  return String($("[data-competition-region-input]")?.value || "").trim();
}

function matchingRegionOptions(query = currentRegionInputValue()) {
  if (!query) return competitionRegionOptions;
  return competitionRegionOptions
    .map(option => ({ option, rank: regionMatchRank(option, query) }))
    .filter(item => Number.isFinite(item.rank))
    .sort((a, b) => a.rank - b.rank || a.option.label.localeCompare(b.option.label))
    .map(item => item.option);
}

function eventMatchesRegionQuery(event, query = "") {
  const value = String(query || "").trim();
  if (!value) return true;
  const matches = matchingRegionOptions(value);
  if (!matches.length) return false;
  return matches.some(option => option.key === eventRegionKey(event));
}

function visibleRegionRows(query = currentRegionInputValue()) {
  const matches = matchingRegionOptions(query);
  if (query) {
    if (matches.length > 1) {
      const count = syncedEvents.filter(event => eventMatchesRegionQuery(event, query)).length;
      return [
        {
          key: REGION_MATCH_KEY,
          label: t("scouting.allMatchingRegions", { query }),
          meta: t("scouting.allMatchingMeta", { regions: matches.length, events: count })
        },
        ...matches
      ];
    }
    return matches;
  }
  return [
    { key: "", label: t("scouting.allSyncedRegions"), meta: t("scouting.showEveryEvent") },
    ...matches
  ];
}

function renderRegionOptions(open = false) {
  const input = $("[data-competition-region-input]");
  const hidden = $("[data-competition-region]");
  const list = $("[data-competition-region-options]");
  if (!input || !hidden || !list) return;

  hidden.value = selectedCompetitionRegion;
  const query = currentRegionInputValue();
  const rows = visibleRegionRows(query);
  highlightedRegionIndex = Math.min(Math.max(highlightedRegionIndex, 0), Math.max(rows.length - 1, 0));
  input.setAttribute("aria-expanded", String(open));
  list.hidden = !open;
  if (!open) return;

  if (!rows.length) {
    list.innerHTML = `
      <div class="region-option region-option-empty" role="option" aria-disabled="true">
        <strong>${escapeHtml(t("scouting.noRegionMatch", { query }))}</strong>
        <small>${escapeHtml(t("scouting.onlyImportedRegions"))}</small>
      </div>
    `;
    return;
  }

  list.innerHTML = rows.map((option, index) => `
    <button
      class="region-option ${index === highlightedRegionIndex ? "active" : ""}"
      type="button"
      role="option"
      data-region-option="${escapeHtml(option.key)}"
      aria-selected="${String(option.key === selectedCompetitionRegion)}"
    >
      <strong>${escapeHtml(option.label)}</strong>
      ${option.meta ? `<small>${escapeHtml(option.meta)}</small>` : ""}
    </button>
  `).join("");
}

function selectCompetitionRegion(key, label = "") {
  if (key === REGION_MATCH_KEY) {
    selectedCompetitionRegion = "";
    const hidden = $("[data-competition-region]");
    if (hidden) hidden.value = "";
    highlightedRegionIndex = -1;
    renderRegionOptions(false);
    return;
  }
  selectedCompetitionRegion = key || "";
  const input = $("[data-competition-region-input]");
  const hidden = $("[data-competition-region]");
  if (input) input.value = selectedCompetitionRegion ? label : "";
  if (hidden) hidden.value = selectedCompetitionRegion;
  highlightedRegionIndex = -1;
  renderRegionOptions(false);
}

function commitRegionInput() {
  const input = $("[data-competition-region-input]");
  if (!input) return;
  const value = String(input.value || "").trim();
  if (!value) {
    selectCompetitionRegion("", "");
    return;
  }
  const matches = visibleRegionRows(value);
  const option = matches[highlightedRegionIndex] || matches[0];
  if (option) selectCompetitionRegion(option.key, option.label);
}

function renderCompetitionPickers(events = syncedEvents) {
  const input = $("[data-competition-region-input]");
  if (!input) return;

  const selectedRegion = selectedCompetitionRegion;
  const regions = Array.from(new Map(sortedSyncedEvents(events)
    .map(event => [eventRegionKey(event), eventRegionLabel(event)])
    .filter(([key]) => key)
  ).entries());

  competitionRegionOptions = regions.map(([key, label]) => {
    const count = syncedEvents.filter(event => eventRegionKey(event) === key).length;
    return {
      key,
      label,
      meta: `${count} synced event${count === 1 ? "" : "s"}`
    };
  });

  const selected = competitionRegionOptions.find(option => option.key === selectedRegion);
  if (selected) {
    selectCompetitionRegion(selected.key, selected.label);
  } else if (selectedRegion) {
    selectCompetitionRegion("", "");
  }
  renderRegionOptions(false);
}

function setCompetitionStatus(message, tone = "") {
  const status = $("[data-competition-status]");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function setTeamSkillsStatus(message, tone = "") {
  const status = $("[data-team-skills-status]");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

async function vexProxyFetch(path) {
  const baseUrl = vexProxyUrl();
  if (!baseUrl) {
    throw new Error(t("scouting.proxyNeeded"));
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Accept": "application/json" }
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(payload?.error || t("scouting.dataError"));
  }
  return payload;
}

function renderCompetitionSource() {
  const source = $("[data-competition-source]");
  const teamSource = $("[data-team-skills-source]");
  if (source) {
    if (syncedEventsLoaded && syncedEvents.length) {
      source.textContent = t("scouting.syncedLocal");
      source.dataset.connected = "true";
    } else {
      source.textContent = t("scouting.noSyncedData");
      source.dataset.connected = "false";
    }
  }
  if (teamSource) {
    teamSource.textContent = vexProxyUrl() ? t("scouting.liveProxy") : t("scouting.noProxy");
    teamSource.dataset.connected = String(Boolean(vexProxyUrl()));
  }
}

function officialSkillsId(row) {
  return String(row.team?.id || row.team?.teamRegId || row.team?.teamNumber || `rank-${row.rank || "unknown"}`);
}

function teamNumberKey(value) {
  return String(value || "").trim().toUpperCase();
}

function officialDateLabel(value) {
  if (!value) return t("scouting.dateNotListed");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(languageLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function teamSkillsLocation(row) {
  return [row.team?.city, row.team?.region, row.team?.country].filter(Boolean).join(", ");
}

function renderTeamSkillsResults(rows = []) {
  const results = $("[data-team-skills-results]");
  if (!results) return;
  results.hidden = false;
  if (!rows.length) {
    results.innerHTML = `<p class="competition-empty">${escapeHtml(t("scouting.noTeamsLong"))}</p>`;
    return;
  }

  results.innerHTML = rows.map((row) => {
    const id = officialSkillsId(row);
    const open = expandedTeamSkillId === id;
    const team = row.team || {};
    const scores = row.scores || {};
    const event = row.event || {};
    const total = seasonSkillTotal(row);
    return `
      <article class="team-skill-card ${open ? "open" : ""}">
        <button class="team-skill-summary" type="button" data-team-skill-toggle="${escapeHtml(id)}" aria-expanded="${open}">
          <span class="team-skill-identity">
            <strong>${escapeHtml(team.teamNumber || t("common.team"))}</strong>
            <small>${escapeHtml(team.teamName || team.organization || t("scouting.officialSkillsResult"))}</small>
          </span>
          <span class="team-skill-chip">${escapeHtml(t("scouting.rank", { rank: row.rank ?? "-" }))}</span>
          <span class="team-skill-score">${escapeHtml(total)}</span>
        </button>
        <div class="team-skill-detail">
          ${open ? `
            <div class="team-skill-stats">
              <span><small>${escapeHtml(t("skills.driver"))}</small><strong>${escapeHtml(scores.maxDriver ?? scores.driver ?? 0)}</strong></span>
              <span><small>${escapeHtml(t("skills.autonomous"))}</small><strong>${escapeHtml(scores.maxProgramming ?? scores.programming ?? 0)}</strong></span>
              <span><small>${escapeHtml(t("scouting.event"))}</small><strong>${escapeHtml(event.sku || t("common.notListed"))}</strong></span>
              <span><small>${escapeHtml(t("scouting.date"))}</small><strong>${escapeHtml(officialDateLabel(event.startDate))}</strong></span>
            </div>
            <p>${escapeHtml([
              team.organization,
              teamSkillsLocation(row),
              team.eventRegion
            ].filter(Boolean).join(" • ") || t("scouting.noExtraTeamDetails"))}</p>
          ` : ""}
        </div>
      </article>
    `;
  }).join("");
}

function loadCachedSeasonSkills() {
  try {
    const cached = JSON.parse(localStorage.getItem(SEASON_SKILLS_STORE_KEY));
    const cachedAt = new Date(cached?.cachedAt || 0).getTime();
    const freshForSixHours = Number.isFinite(cachedAt) && Date.now() - cachedAt < 6 * 60 * 60 * 1000;
    if (cached && Array.isArray(cached.skills) && freshForSixHours) return cached.skills;
  } catch {
    return null;
  }
  return null;
}

function buildSeasonSkillsIndex(rows = []) {
  const byTeam = new Map();
  rows.forEach((row) => {
    const key = teamNumberKey(row.team?.teamNumber);
    if (!key) return;
    if (!byTeam.has(key) || seasonSkillTotal(row) > seasonSkillTotal(byTeam.get(key))) {
      byTeam.set(key, row);
    }
  });
  return { rows, byTeam };
}

function seasonSkillTotal(row) {
  const scores = row?.scores || {};
  const driver = Number(scores.maxDriver ?? scores.driver ?? 0);
  const programming = Number(scores.maxProgramming ?? scores.programming ?? 0);
  const combined = driver + programming;
  return combined || Number(scores.score || 0);
}

async function ensureSeasonSkillsIndex() {
  if (seasonSkillsIndex) return seasonSkillsIndex;
  if (seasonSkillsPromise) return seasonSkillsPromise;

  seasonSkillsPromise = (async () => {
    const cached = loadCachedSeasonSkills();
    if (cached) {
      seasonSkillsIndex = buildSeasonSkillsIndex(cached);
      return seasonSkillsIndex;
    }
    const payload = await vexProxyFetch("/api/skills/standings");
    const rows = Array.isArray(payload.skills) ? payload.skills : [];
    try {
      localStorage.setItem(SEASON_SKILLS_STORE_KEY, JSON.stringify({
        cachedAt: new Date().toISOString(),
        skills: rows
      }));
    } catch {
      // The standings can be large; keep the in-memory index even if browser storage is full.
    }
    seasonSkillsIndex = buildSeasonSkillsIndex(rows);
    return seasonSkillsIndex;
  })();

  return seasonSkillsPromise;
}

function skillsRowMatches(row, query) {
  const team = row.team || {};
  const event = row.event || {};
  const haystack = [
    team.teamNumber,
    team.teamName,
    team.organization,
    team.city,
    team.region,
    team.country,
    team.eventRegion,
    regionSearchText(team.eventRegion),
    event.sku
  ].filter(Boolean).join(" ");
  return searchTextMatches(haystack, query);
}

async function searchTeamSkills(query) {
  setTeamSkillsStatus(t("scouting.searchingSkills"), "loading");
  const index = await ensureSeasonSkillsIndex();
  teamSkillsResults = index.rows.filter(row => skillsRowMatches(row, query)).slice(0, 50);
  expandedTeamSkillId = null;
  renderTeamSkillsResults(teamSkillsResults);
  setTeamSkillsStatus(teamSkillsResults.length
    ? countText("scouting.foundTeams", teamSkillsResults.length)
    : t("scouting.noTeams"),
    teamSkillsResults.length ? "ready" : "warn"
  );
}

function renderJudgeTeamIdentity() {
  const card = $("[data-judge-team-card]");
  if (!card) return;
  card.hidden = !isJudgeMode;
  if (!isJudgeMode) return;

  const team = judgeTeamIdentity;
  if (!team) {
    card.innerHTML = `<p>${escapeHtml(t("scouting.loadingCompetitions"))}</p>`;
    return;
  }

  card.innerHTML = `
    <div class="judge-team-heading">
      <div>
        <span class="brand-kicker">${escapeHtml(t("judge.identityKicker"))}</span>
        <h2>${escapeHtml(team.teamNumber)} ${escapeHtml(team.teamName)}</h2>
        <p>${escapeHtml(t("judge.identitySource"))}</p>
      </div>
      <span class="judge-team-verified" aria-hidden="true">✓</span>
    </div>
    <dl class="judge-team-facts">
      <div><dt>${escapeHtml(t("judge.robot"))}</dt><dd>${escapeHtml(team.robotName || t("common.notListed"))}</dd></div>
      <div><dt>${escapeHtml(t("judge.organization"))}</dt><dd>${escapeHtml(team.organization || t("common.notListed"))}</dd></div>
      <div><dt>${escapeHtml(t("judge.location"))}</dt><dd>${escapeHtml(team.location || t("common.notListed"))}</dd></div>
      <div><dt>${escapeHtml(t("judge.officialSkills"))}</dt><dd>${escapeHtml(teamSkillsResults.length ? seasonSkillTotal(teamSkillsResults[0]) : "--")}</dd></div>
    </dl>`;
}

function renderJudgeOfficialSkillsState() {
  if (!isJudgeMode || !judgeSkillsLookupComplete) return;
  if (teamSkillsResults.length) {
    setTeamSkillsStatus(t("judge.officialSkillsFound"), "ready");
    return;
  }
  const results = $("[data-team-skills-results]");
  if (results) {
    results.hidden = false;
    results.innerHTML = `<p class="competition-empty">${escapeHtml(t("judge.officialSkillsPending"))}</p>`;
  }
  setTeamSkillsStatus(t("judge.officialSkillsPending"), "ready");
}

async function initializeJudgeScouting() {
  if (!isJudgeMode) return;
  if (judgeScoutingPromise) return judgeScoutingPromise;
  judgeScoutingPromise = (async () => {
    await ensureSyncedTeamIndex();
    const entry = (syncedTeamIndex?.byTeam.get("4330P") || []).find(item => item.team?.teamName === "RoboPigeons")
      || (syncedTeamIndex?.byTeam.get("4330P") || [])[0];
    judgeTeamIdentity = entry?.team || null;
    renderJudgeTeamIdentity();
    renderMyCompetitions();

    const input = $("[data-team-skills-search-form] input[name='teamSkillsSearch']");
    if (input) input.value = "4330P";
    try {
      await searchTeamSkills("4330P");
      judgeSkillsLookupComplete = true;
      renderJudgeOfficialSkillsState();
      renderJudgeTeamIdentity();
    } catch (error) {
      setTeamSkillsStatus(error.message || t("scouting.skillsError"), "warn");
    }
  })();
  return judgeScoutingPromise;
}

async function ensureSyncedTeamIndex() {
  await ensureSyncedEventsLoaded();
  if (syncedTeamIndex) return syncedTeamIndex;
  if (syncedTeamIndexPromise) return syncedTeamIndexPromise;

  syncedTeamIndexPromise = (async () => {
    const byTeam = new Map();
    const eventText = new Map();
    const eventsById = new Map(syncedEvents.map(event => [localEventId(event), event]));

    await mapWithConcurrency(syncedEvents, 12, async (event) => {
      const id = localEventId(event);
      const teamsPath = event.paths?.teams || `data/events/${id}/teams.json`;
      const payload = await readLocalJson(teamsPath).catch(() => ({ data: [] }));
      const teams = Array.isArray(payload.data) ? payload.data.map(normalizeLocalTeam) : [];
      const terms = [];
      teams.forEach((team) => {
        const number = String(team.teamNumber || "").trim();
        if (!number) return;
        const key = number.toUpperCase();
        const entry = { event: eventsById.get(id) || event, team };
        if (!byTeam.has(key)) byTeam.set(key, []);
        byTeam.get(key).push(entry);
        terms.push(number, team.teamName, team.organization, team.robotName);
      });
      eventText.set(id, normalizeSearchText(terms.filter(Boolean).join(" ")));
    });

    syncedTeamIndex = { byTeam, eventText };
    return syncedTeamIndex;
  })();

  return syncedTeamIndexPromise;
}

function myCompetitionEntries() {
  const teamNumber = String(profile?.teamNumber || "").trim().toUpperCase();
  if (!teamNumber || !syncedTeamIndex) return [];
  return syncedTeamIndex.byTeam.get(teamNumber) || [];
}

function myCompetitionEvents() {
  const seen = new Set();
  return myCompetitionEntries()
    .map(entry => entry.event)
    .filter((event) => {
      const id = localEventId(event);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function renderMyCompetitions() {
  const wrap = $("[data-my-competitions]");
  if (!wrap) return;
  wrap.hidden = false;

  const teamLabel = profile?.teamName
    ? `${profile.teamNumber} ${profile.teamName}`
    : (profile?.teamNumber || "your team");
  const events = sortedSyncedEvents(myCompetitionEvents());
  if (!profile?.teamNumber) {
    wrap.innerHTML = `
      <div class="my-competitions-head">
        <span class="brand-kicker">${escapeHtml(t("scouting.myCompetitions"))}</span>
        <strong>${escapeHtml(t("scouting.enterTeam"))}</strong>
      </div>
    `;
    return;
  }

  if (!events.length) {
    wrap.innerHTML = `
      <div class="my-competitions-head">
        <span class="brand-kicker">${escapeHtml(t("scouting.myCompetitions"))}</span>
        <strong>${escapeHtml(t("scouting.noMyEvents", { team: teamLabel }))}</strong>
        <p>${escapeHtml(t("scouting.tryAll"))}</p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="my-competitions-head">
      <span class="brand-kicker">${escapeHtml(t("scouting.myCompetitions"))}</span>
      <strong>${escapeHtml(t(countKey("scouting.myEvents", events.length), { count: events.length, team: teamLabel }))}</strong>
    </div>
    <div class="my-competition-list">
      ${events.map(event => eventCardMarkup(event, "mine")).join("")}
    </div>
  `;
}

function eventCardMarkup(event, variant = "") {
  const id = localEventId(event);
  const officialRegion = officialEventRegionName(event);
  return `
    <article class="competition-result ${variant ? `competition-result-${variant}` : ""}">
      <div>
        <span>${escapeHtml(event.sku || event.code || t("scouting.eventWithId", { id }))} • ${escapeHtml(t("scouting.event"))} ${escapeHtml(id)}</span>
        <h3>${escapeHtml(event.name || t("scouting.unnamedEvent"))}</h3>
        <p>${escapeHtml(competitionDateLabel(event))}${competitionLocation(event) ? ` • ${escapeHtml(competitionLocation(event))}` : ""}</p>
        ${officialRegion ? `<p class="competition-official-region">${escapeHtml(officialRegion)}</p>` : ""}
        <div class="competition-counts" aria-label="${escapeHtml(t("scouting.syncedDataCounts"))}">
          <strong>${escapeHtml(t("scouting.count.teams", { count: event.teamCount ?? 0 }))}</strong>
          <strong>${escapeHtml(t("scouting.count.skills", { count: event.skillCount ?? 0 }))}</strong>
          <strong>${escapeHtml(t("scouting.count.awards", { count: event.awardCount ?? 0 }))}</strong>
        </div>
      </div>
      <button class="modal-button secondary" type="button" data-import-event="${escapeHtml(id)}">${escapeHtml(t("scouting.viewImport"))}</button>
    </article>
  `;
}

function renderCompetitionFilters() {
  $$("[data-competition-filter]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.competitionFilter === competitionQuickFilter));
  });
}

function renderCompetitionResults(events = []) {
  const results = $("[data-competition-results]");
  if (!results) return;
  results.hidden = false;
  if (!events.length) {
    results.innerHTML = `<p class="competition-empty">${escapeHtml(t("scouting.noCompetitionMatches"))}</p>`;
    return;
  }

  results.innerHTML = events.map(event => eventCardMarkup(event)).join("");
}

function eventSkillRowsForTeam(team) {
  const skills = Array.isArray(importedCompetition?.skills) ? importedCompetition.skills : [];
  const number = teamNumberKey(team.teamNumber || team.number);
  const id = String(team.id || "");
  return skills.filter((row) => {
    const rowNumber = teamNumberKey(row.team?.name || row.team?.teamNumber || row.team?.team);
    const rowId = String(row.team?.id || row.teamId || "");
    return (number && rowNumber === number) || (id && rowId === id);
  });
}

function seasonSkillForTeam(team) {
  const key = teamNumberKey(team.teamNumber || team.number);
  return key && seasonSkillsIndex?.byTeam ? seasonSkillsIndex.byTeam.get(key) : null;
}

function teamLocationLine(team) {
  return [team.location, team.city, team.region, team.country].filter(Boolean).join(" • ");
}

function competitionTeamMarkup(team) {
  const number = team.teamNumber || team.number || "Team";
  const id = teamNumberKey(number);
  const open = expandedCompetitionTeam === id;
  const seasonSkill = seasonSkillForTeam(team);
  const eventSkills = eventSkillRowsForTeam(team);
  const total = seasonSkill ? seasonSkillTotal(seasonSkill) : null;
  const scores = seasonSkill?.scores || {};
  return `
    <article class="competition-team-row ${open ? "open" : ""}">
      <button class="competition-team-summary" type="button" data-competition-team-toggle="${escapeHtml(id)}" aria-expanded="${open}">
        <span class="team-main">
          <strong>${escapeHtml(number)}</strong>
          <small>${escapeHtml(team.teamName || team.name || team.organization || t("scouting.teamDetails"))}</small>
        </span>
      </button>
      <div class="competition-team-detail">
        ${open ? `
          <div class="team-skill-stats">
            <span><small>${escapeHtml(t("scouting.seasonSkills"))}</small><strong>${escapeHtml(total ?? t("common.notLoaded"))}</strong></span>
            <span><small>${escapeHtml(t("skills.driver"))}</small><strong>${escapeHtml(scores.maxDriver ?? scores.driver ?? 0)}</strong></span>
            <span><small>${escapeHtml(t("skills.autonomous"))}</small><strong>${escapeHtml(scores.maxProgramming ?? scores.programming ?? 0)}</strong></span>
            <span><small>${escapeHtml(t("scouting.eventSkills"))}</small><strong>${escapeHtml(eventSkills.length)}</strong></span>
          </div>
          <p>${escapeHtml([
            team.robotName ? `${t("scouting.robot")}: ${team.robotName}` : "",
            team.organization,
            teamLocationLine(team)
          ].filter(Boolean).join(" • ") || t("scouting.noAdditionalTeamDetails"))}</p>
          ${eventSkills.length ? `
            <div class="event-skill-list">
              ${eventSkills.map(row => `
                <span>
                  <small>${escapeHtml(row.type || "skills")}${row.rank ? ` • ${escapeHtml(t("scouting.rank", { rank: row.rank }))}` : ""}</small>
                  <strong>${escapeHtml(row.score ?? 0)}</strong>
                  ${row.attempts ? `<small>${escapeHtml(t("scouting.attempts", { count: row.attempts }))}</small>` : ""}
                </span>
              `).join("")}
            </div>
          ` : ""}
        ` : ""}
      </div>
    </article>
  `;
}

function awardWinnerLabel(winner, teamByNumber = new Map()) {
  const team = winner?.team || winner;
  const number = team?.name || team?.number || team?.teamNumber || "";
  if (!number) return "";
  const registeredTeam = teamByNumber.get(teamNumberKey(number));
  const label = registeredTeam?.teamName || registeredTeam?.name || registeredTeam?.organization || "";
  return label && teamNumberKey(label) !== teamNumberKey(number) ? `${number} - ${label}` : number;
}

function competitionAwardsMarkup(awards = [], teams = []) {
  if (!awards.length) return `<p class="competition-empty">${escapeHtml(t("scouting.noAwards"))}</p>`;
  const teamByNumber = new Map(teams.map(team => [teamNumberKey(team.teamNumber || team.number), team]).filter(([number]) => number));
  return awards.map(award => `
    <article class="competition-award-row">
      <div>
        <strong>${escapeHtml(award.title || t("scouting.award"))}</strong>
        <small>${escapeHtml([
          award.classification,
          award.designation
        ].filter(Boolean).join(" • "))}</small>
      </div>
      <p>${escapeHtml((award.teamWinners || []).map(winner => awardWinnerLabel(winner, teamByNumber)).filter(Boolean).join(", ") || t("scouting.winnerNotListed"))}</p>
    </article>
  `).join("");
}

function renderImportedCompetition() {
  renderCompetitionSource();
  const panel = $("[data-competition-current]");
  if (!panel) return;

  if (!importedCompetition) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  $("[data-competition-name]").textContent = importedCompetition.name || t("scouting.importedCompetition");
  $("[data-competition-meta]").textContent = [
    importedCompetition.eventCode,
    importedCompetition.date,
    importedCompetition.eventRegionName,
    importedCompetition.location
  ].filter(Boolean).join(" • ");
  const teams = Array.isArray(importedCompetition.teams) ? importedCompetition.teams : [];
  const awards = Array.isArray(importedCompetition.awards) ? importedCompetition.awards : [];
  const teamCount = importedCompetition.teamCount ?? teams.length;
  const skillCount = importedCompetition.skillCount ?? 0;
  const awardCount = importedCompetition.awardCount ?? 0;
  $("[data-competition-team-count]").textContent = t("scouting.count.teams", { count: teamCount });
  $("[data-competition-progress]").textContent = importedCompetition.loadedAt
    ? t("scouting.loadedDetail", {
      date: new Date(importedCompetition.loadedAt).toLocaleString(languageLocale()),
      skills: skillCount,
      awards: awardCount
    })
    : "";
  const teamList = $("[data-competition-team-list]");
  if (teamList) {
    teamList.innerHTML = `
      <div class="competition-section-title">
        <strong>${escapeHtml(t("scouting.teams"))}</strong>
        <span>${escapeHtml(t("scouting.teamsHint"))}</span>
      </div>
      ${teams.length ? teams.map(competitionTeamMarkup).join("") : `<p class="competition-empty">${escapeHtml(t("scouting.noRegisteredTeams"))}</p>`}
    `;
  }
  const awardsList = $("[data-competition-awards-list]");
  if (awardsList) {
    awardsList.innerHTML = `
      <div class="competition-section-title">
        <strong>${escapeHtml(t("scouting.awards"))}</strong>
        <span>${escapeHtml(countText("scouting.awardsSynced", awardCount))}</span>
      </div>
      ${competitionAwardsMarkup(awards, teams)}
    `;
  }
  if (!seasonSkillsIndex && !seasonSkillsPromise) {
    ensureSeasonSkillsIndex().then(() => renderImportedCompetition()).catch(() => {
      seasonSkillsIndex = buildSeasonSkillsIndex([]);
      renderImportedCompetition();
    });
  }
}

async function searchCompetitions(query) {
  await ensureSyncedEventsLoaded();
  if (!syncedEvents.length) {
    competitionSearchResults = [];
    renderCompetitionResults(competitionSearchResults);
    renderCompetitionPickers();
    renderMyCompetitions();
    setCompetitionStatus(syncedEventsError || t("scouting.noSynced"), "warn");
    return;
  }
  setCompetitionStatus(t("scouting.searchingCompetitions"), "loading");
  await ensureSyncedTeamIndex();
  const { region, regionQuery } = competitionFilterValues();
  const searchInput = $("[data-competition-search-form] input[name='competitionSearch']");
  if (searchInput && searchInput.value.trim() !== query) searchInput.value = query;
  const matchingRegions = regionQuery ? matchingRegionOptions(regionQuery) : [];
  competitionSearchResults = sortedSyncedEvents(syncedEvents.filter(event =>
    eventMatchesQuickFilter(event) &&
    localEventMatches(event, query, region) &&
    eventMatchesRegionQuery(event, regionQuery)
  ), query);
  renderCompetitionPickers();
  renderCompetitionFilters();
  renderMyCompetitions();
  renderCompetitionResults(competitionSearchResults);
  let statusMessage = competitionSearchResults.length
    ? countText("scouting.foundCompetitions", competitionSearchResults.length)
    : t("scouting.noCompetitionMatches");
  if (regionQuery) {
    statusMessage = matchingRegions.length
      ? t(countKey("scouting.foundAcross", matchingRegions.length), {
        count: competitionSearchResults.length,
        regions: matchingRegions.length
      })
      : t("scouting.noRegionMatch", { query: regionQuery });
  }
  setCompetitionStatus(statusMessage, competitionSearchResults.length ? "ready" : "warn");
}

async function ensureSyncedEventsLoaded() {
  if (syncedEventsLoaded || syncedEventsError) return;
  try {
    const response = await fetch("data/events/index.json", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(t("scouting.noSynced"));
    const payload = await response.json();
    syncedEvents = Array.isArray(payload.events) ? payload.events : [];
    syncedEventsLoaded = true;
    renderCompetitionSource();
    if (syncedEvents.length) {
      const updated = payload.updatedAt
        ? t("scouting.lastUpdated", { date: new Date(payload.updatedAt).toLocaleString(languageLocale()) })
        : "";
      setCompetitionStatus(t(countKey("scouting.loaded", syncedEvents.length), { count: syncedEvents.length, updated }), "ready");
      renderCompetitionPickers();
      renderCompetitionFilters();
      renderCompetitionResults(sortedSyncedEvents(syncedEvents).slice(0, 12));
      ensureSyncedTeamIndex().then(() => {
        renderMyCompetitions();
        if (competitionQuickFilter === "mine") searchCompetitions(competitionFilterValues().query);
      }).catch(() => renderMyCompetitions());
    } else {
      renderCompetitionPickers();
      renderMyCompetitions();
      setCompetitionStatus(t("scouting.noSynced"), "warn");
    }
  } catch (error) {
    syncedEvents = [];
    syncedEventsError = error.message || t("scouting.noSynced");
    renderCompetitionSource();
    renderCompetitionPickers();
    renderMyCompetitions();
    setCompetitionStatus(syncedEventsError, "warn");
  }
}

async function mapWithConcurrency(items, limit, mapper, onProgress) {
  const results = new Array(items.length);
  let index = 0;
  let completed = 0;
  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      try {
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      } catch {
        results[currentIndex] = { ...items[currentIndex], officialMatches: [], officialSkills: [], officialRankings: [] };
      }
      completed += 1;
      onProgress?.(completed, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function importCompetition(eventId) {
  await ensureSyncedEventsLoaded();
  if (syncedEvents.length) {
    await importLocalCompetition(eventId);
    return;
  }
  await importCompetitionFromProxy(eventId);
}

async function readLocalJson(path) {
  const response = await fetch(path, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error("Synced competition data could not load. Try importing the VEX bundle again.");
  return response.json();
}

function normalizeLocalTeam(team) {
  const location = team.location || {};
  return {
    id: team.id,
    teamNumber: team.number || team.teamNumber || "",
    teamName: team.team_name || team.teamName || team.name || "",
    robotName: team.robot_name || team.robotName || "",
    organization: team.organization || "",
    location: [location.city, location.region, location.country].filter(Boolean).join(", "),
    grade: team.grade || "",
    registered: team.registered ?? null
  };
}

async function importLocalCompetition(eventId) {
  const event = syncedEvents.find(item => localEventId(item) === String(eventId));
  if (!event) throw new Error("That synced competition was not found. Search again after importing a fresh bundle.");

  setCompetitionStatus("Loading synced competition files...", "loading");
  const [eventPayload, teamsPayload, skillsPayload, awardsPayload, metaPayload] = await Promise.all([
    readLocalJson(event.paths?.event || `data/events/${eventId}/event.json`),
    readLocalJson(event.paths?.teams || `data/events/${eventId}/teams.json`),
    readLocalJson(event.paths?.skills || `data/events/${eventId}/skills.json`),
    readLocalJson(event.paths?.awards || `data/events/${eventId}/awards.json`),
    readLocalJson(event.paths?.meta || `data/events/${eventId}/meta.json`).catch(() => ({}))
  ]);

  const teams = Array.isArray(teamsPayload.data) ? teamsPayload.data.map(normalizeLocalTeam) : [];
  const skills = Array.isArray(skillsPayload.data) ? skillsPayload.data : [];
  const awards = Array.isArray(awardsPayload.data) ? awardsPayload.data : [];
  const eventData = eventPayload?.data || {};

  writeCompetitionData({
    eventId: event.eventId || eventData.id || eventId,
    eventCode: event.sku || eventData.sku || eventData.code || "",
    name: event.name || eventData.name || "Imported competition",
    date: competitionDateLabel(event),
    location: competitionLocation(event) || eventLocationFromData(eventPayload),
    eventRegionId: officialEventRegionId(event) || metaPayload?.eventRegion?.id || null,
    eventRegionName: officialEventRegionName(event) || metaPayload?.eventRegion?.name || "",
    loadedAt: new Date().toISOString(),
    teamCount: teams.length,
    skillCount: skills.length,
    awardCount: awards.length,
    teams,
    skills,
    awards,
    meta: metaPayload
  });
  renderImportedCompetition();
  setCompetitionStatus(`Imported ${teams.length} teams, ${skills.length} skills rows, and ${awards.length} awards from synced data.`, "ready");
  showToast(t("toast.competitionImported"));
}

async function importCompetitionFromProxy(eventId) {
  setCompetitionStatus("Loading selected competition...", "loading");
  const [eventPayload, teamsPayload] = await Promise.all([
    vexProxyFetch(`/api/events/${encodeURIComponent(eventId)}`),
    vexProxyFetch(`/api/events/${encodeURIComponent(eventId)}/teams`)
  ]);
  const event = eventPayload.event || {};
  const teams = Array.isArray(teamsPayload.teams) ? teamsPayload.teams : [];

  setCompetitionStatus(`Loaded event. Caching official history for ${teams.length} teams...`, "loading");
  const teamsWithHistory = await mapWithConcurrency(teams, 4, async (team) => {
    const history = await vexProxyFetch(`/api/teams/${encodeURIComponent(team.id)}/history`);
    return {
      ...team,
      officialMatches: history.matches || [],
      officialSkills: history.skills || [],
      officialRankings: history.rankings || []
    };
  }, (done, total) => {
    setCompetitionStatus(`Loaded ${done} of ${total} teams.`, "loading");
  });

  writeCompetitionData({
    eventId: event.id || eventId,
    eventCode: event.code || "",
    name: event.name || "Imported competition",
    date: competitionDateLabel(event),
    location: competitionLocation(event),
    eventRegionId: event.eventRegionId || null,
    eventRegionName: event.eventRegionName || "",
    loadedAt: new Date().toISOString(),
    teams: teamsWithHistory
  });
  renderImportedCompetition();
  setCompetitionStatus("Competition data loaded and saved on this device.", "ready");
  showToast(t("toast.competitionImported"));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(activeProfileStoreKey()));
    if (saved && typeof saved.teamNumber === "string" && saved.teamNumber.trim()) {
      return {
        teamNumber: saved.teamNumber.trim(),
        teamName: typeof saved.teamName === "string" ? saved.teamName.trim() : "",
        teamSource: typeof saved.teamSource === "string" ? saved.teamSource : "",
        createdAt: saved.createdAt || new Date().toISOString()
      };
    }
  } catch {
    return null;
  }
  return null;
}

function saveProfile(teamNumber, teamName = "", teamSource = "") {
  const nextProfile = {
    teamNumber: teamNumber.trim(),
    teamName: teamName.trim(),
    teamSource,
    createdAt: new Date().toISOString()
  };
  localStorage.setItem(activeProfileStoreKey(), JSON.stringify(nextProfile));
  profile = nextProfile;
  return nextProfile;
}

async function findTeamInSyncedEvents(teamNumber) {
  await ensureSyncedTeamIndex();
  const entries = syncedTeamIndex?.byTeam.get(teamNumber.trim().toUpperCase()) || [];
  const namedEntry = entries.find(entry => entry.team?.teamName);
  if (!namedEntry) return null;
  return {
    teamNumber: namedEntry.team.teamNumber,
    teamName: namedEntry.team.teamName,
    teamSource: "synced-events"
  };
}

async function findTeamInSkills(teamNumber) {
  if (!vexProxyUrl()) return null;
  try {
    const payload = await vexProxyFetch(`/api/skills/search?q=${encodeURIComponent(teamNumber.trim())}`);
    const rows = Array.isArray(payload.skills) ? payload.skills : [];
    const match = rows.find(row => String(row.team?.teamNumber || "").toUpperCase() === teamNumber.trim().toUpperCase());
    if (!match?.team?.teamName) return null;
    return {
      teamNumber: match.team.teamNumber,
      teamName: match.team.teamName,
      teamSource: "skills"
    };
  } catch {
    return null;
  }
}

async function findTeamIdentity(teamNumber) {
  const localMatch = await findTeamInSyncedEvents(teamNumber).catch(() => null);
  if (localMatch) return localMatch;
  return findTeamInSkills(teamNumber).catch(() => null);
}

function renderSetupConfirmation(match) {
  const confirm = $("[data-setup-confirm]");
  const name = $("[data-setup-confirm-name]");
  const submit = $("[data-setup-submit]");
  if (!confirm || !name) return;
  pendingProfileMatch = match;
  name.textContent = t("setup.confirmIdentity", { teamNumber: match.teamNumber, teamName: match.teamName });
  confirm.hidden = false;
  if (submit) submit.textContent = t("setup.checkAnother");
}

function clearSetupConfirmation() {
  const confirm = $("[data-setup-confirm]");
  const submit = $("[data-setup-submit]");
  pendingProfileMatch = null;
  if (confirm) confirm.hidden = true;
  if (submit) submit.textContent = t("setup.checkTeam");
}

function finishProfileSetup(nextProfile) {
  renderBanner();
  renderMyCompetitions();
  renderCompetitionResults(filteredSyncedEvents().slice(0, 12));
  closeSetupModal();
  showToast(nextProfile.teamName
    ? t("toast.teamNameSaved", { teamNumber: nextProfile.teamNumber, teamName: nextProfile.teamName })
    : t("toast.teamSaved", { teamNumber: nextProfile.teamNumber })
  );
}

function cloneScorerState() {
  return {
    auton: state.auton,
    robots: { ...state.robots },
    quadrants: Object.fromEntries(quadrants.map(quadrant => [
      quadrant,
      { ...state.quadrants[quadrant] }
    ]))
  };
}

function cloneSkillsState() {
  return {
    centerToggle: skillsState.centerToggle,
    toggles: { ...skillsState.toggles },
    quadrants: Object.fromEntries(skillsQuadrants.map(quadrant => [
      quadrant,
      { ...skillsState.quadrants[quadrant] }
    ]))
  };
}

function blankDetails() {
  return {
    partnerTeam: "",
    partnerNotes: "",
    opponentOne: "",
    opponentOneNotes: "",
    opponentTwo: "",
    opponentTwoNotes: ""
  };
}

function formDetails() {
  const form = $("[data-save-form]");
  if (!form) return blankDetails();
  const data = new FormData(form);
  return Object.fromEntries(Object.keys(blankDetails()).map(key => [
    key,
    String(data.get(key) || "").trim()
  ]));
}

function matchResult(ourScore, opponentScore) {
  if (ourScore > opponentScore) return "win";
  if (ourScore < opponentScore) return "loss";
  return "tie";
}

function createMatchRecord(details) {
  const savedAt = new Date();
  const redScore = scoreAlliance("red");
  const blueScore = scoreAlliance("blue");
  const ourScore = teamAlliance === "red" ? redScore : blueScore;
  const opponentScore = teamAlliance === "red" ? blueScore : redScore;
  return {
    id: crypto?.randomUUID?.() || `match-${savedAt.getTime()}-${Math.random().toString(16).slice(2)}`,
    savedAt: savedAt.toISOString(),
    savedDate: savedAt.toLocaleDateString(languageLocale(), {
      year: "numeric",
      month: "short",
      day: "numeric"
    }),
    teamNumber: profile?.teamNumber || "",
    teamAlliance,
    redScore,
    blueScore,
    ourScore,
    opponentScore,
    result: matchResult(ourScore, opponentScore),
    scorer: cloneScorerState(),
    details: { ...blankDetails(), ...details }
  };
}

function createSkillsRunRecord(notes = "") {
  const savedAt = new Date();
  return {
    id: crypto?.randomUUID?.() || `skills-${savedAt.getTime()}-${Math.random().toString(16).slice(2)}`,
    mode: "skills",
    savedAt: savedAt.toISOString(),
    savedDate: savedAt.toLocaleDateString(languageLocale(), {
      year: "numeric",
      month: "short",
      day: "numeric"
    }),
    teamNumber: profile?.teamNumber || "",
    skillsType: skillsRunType,
    score: scoreSkills(),
    skills: cloneSkillsState(),
    notes: String(notes || "").trim()
  };
}

function midpointOwnerFromRobots(robots = {}) {
  const red = Number(Boolean(robots["red-1"])) + Number(Boolean(robots["red-2"]));
  const blue = Number(Boolean(robots["blue-1"])) + Number(Boolean(robots["blue-2"]));
  if (red > blue) return "red";
  if (blue > red) return "blue";
  return "neutral";
}

function scoreScorerSnapshot(scorer, alliance) {
  let score = 0;
  const centerOwner = midpointOwnerFromRobots(scorer.robots);

  if (scorer.auton === alliance) score += POINTS.auton;
  if (scorer.auton === "tie") score += POINTS.autonTie;

  quadrants.forEach((quadrant) => {
    const q = scorer.quadrants?.[quadrant] || { toggle: "neutral", yellow: 0, red: 0, blue: 0 };
    score += Number(q[alliance] || 0) * POINTS.alliancePin;
    const owner = quadrant === "center" ? centerOwner : q.toggle;
    if (owner === alliance) score += Number(q.yellow || 0) * POINTS.yellowPin;
  });

  Object.entries(scorer.robots || {}).forEach(([robotId, active]) => {
    if (active && robotId.startsWith(alliance)) score += POINTS.midfieldRobot;
  });

  return score;
}

function scoreSkillsSnapshot(snapshot) {
  const q = snapshot.quadrants;
  let score = 0;

  score += (q.left.red + q.bottom.red + q.center.red) * POINTS.alliancePin;
  score += (q.top.blue + q.right.blue + q.center.blue) * POINTS.alliancePin;

  if (snapshot.toggles.left === "red") score += q.left.yellow * POINTS.yellowPin;
  if (snapshot.toggles.bottom === "red") score += q.bottom.yellow * POINTS.yellowPin;
  if (snapshot.toggles.top === "blue") score += q.top.yellow * POINTS.yellowPin;
  if (snapshot.toggles.right === "blue") score += q.right.yellow * POINTS.yellowPin;

  if (snapshot.centerToggle) {
    score += POINTS.midfieldRobot;
    score += q.center.yellow * POINTS.yellowPin;
  }

  return score;
}

function sampleSavedDate(date) {
  return date.toLocaleDateString(languageLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(16 + (days % 5), (days * 7) % 60, 0, 0);
  return date;
}

function loadDevAutofillState() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEV_AUTOFILL_STORE_KEY));
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveDevAutofillState(nextState) {
  devAutofillState = nextState;
  try {
    localStorage.setItem(DEV_AUTOFILL_STORE_KEY, JSON.stringify(nextState));
  } catch {
    // Diagnostics are optional; generated match data remains usable without this key.
  }
}

function createDevRandom(seed = Date.now()) {
  let value = Math.trunc(Number(seed)) >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function randomItem(values, random) {
  return values[Math.floor(random() * values.length)];
}

function chooseDevScenario(values, previous, random) {
  const available = values.filter(value => value !== previous);
  return randomItem(available.length ? available : values, random);
}

function chooseDevTrajectory(random) {
  const roll = random();
  if (roll < .6) return "improving";
  if (roll < .75) return "steady";
  if (roll < .9) return "recovery";
  return "decline";
}

function sampleTrajectoryForm(progress, shape, noise) {
  const variation = (noise - .5) * .16;
  if (shape === "steady") return Math.max(.2, Math.min(1, .63 + Math.sin(progress * Math.PI * 4) * .04 + variation));
  if (shape === "recovery") {
    const setback = .42 * Math.exp(-Math.pow((progress - .55) / .17, 2));
    return Math.max(.16, Math.min(1, .66 + progress * .16 - setback + variation));
  }
  if (shape === "decline") return Math.max(.16, Math.min(1, .88 - progress * .5 + variation));
  return Math.max(.16, Math.min(1, .3 + progress * .58 + variation));
}

function seededRandom(seed) {
  const x = Math.sin(seed * 999) * 10000;
  return x - Math.floor(x);
}

function sampleQuadrants(seed) {
  return {
    top: { toggle: seed.topToggle, yellow: seed.topY, red: seed.topR, blue: seed.topB },
    right: { toggle: seed.rightToggle, yellow: seed.rightY, red: seed.rightR, blue: seed.rightB },
    bottom: { toggle: seed.bottomToggle, yellow: seed.bottomY, red: seed.bottomR, blue: seed.bottomB },
    left: { toggle: seed.leftToggle, yellow: seed.leftY, red: seed.leftR, blue: seed.leftB },
    center: { toggle: "neutral", yellow: seed.centerY, red: seed.centerR, blue: seed.centerB }
  };
}

function sampleHeadSeed(index, total, scenario, trajectoryShape, salt) {
  const progress = total <= 1 ? 1 : index / (total - 1);
  const daysAgoValue = Math.round((1 - progress) * (84 + Math.floor(seededRandom(salt) * 42)));
  const teamAlliance = (index + Math.floor(salt)) % 2 === 0 ? "blue" : "red";
  const ourColor = teamAlliance;
  const opponentColor = teamAlliance === "red" ? "blue" : "red";
  const noise = seededRandom(salt + index * 7.13);
  const form = sampleTrajectoryForm(progress, trajectoryShape, noise);
  const ourBase = 2 + Math.floor(form * 5);
  const oppBase = 2 + Math.floor((1 - form) * 4 + seededRandom(salt + index * 3.7) * 2);
  const seed = {
    daysAgo: daysAgoValue,
    teamAlliance,
    auton: index % 8 === 0 ? "tie" : ourColor,
    redRobots: teamAlliance === "red" ? 2 : 0,
    blueRobots: teamAlliance === "blue" ? 2 : 0,
    topToggle: ourColor,
    rightToggle: ourColor,
    bottomToggle: ourColor,
    leftToggle: ourColor,
    topY: 1 + Math.floor(form * 2),
    topR: teamAlliance === "red" ? ourBase : oppBase,
    topB: teamAlliance === "blue" ? ourBase : oppBase,
    rightY: 1 + Math.floor(form * 2),
    rightR: teamAlliance === "red" ? ourBase : oppBase,
    rightB: teamAlliance === "blue" ? ourBase : oppBase,
    bottomY: 1 + Math.floor(form * 2),
    bottomR: teamAlliance === "red" ? ourBase : oppBase,
    bottomB: teamAlliance === "blue" ? ourBase : oppBase,
    leftY: 1 + Math.floor(form * 2),
    leftR: teamAlliance === "red" ? ourBase : oppBase,
    leftB: teamAlliance === "blue" ? ourBase : oppBase,
    centerY: 1 + Math.floor(form * 2),
    centerR: teamAlliance === "red" ? Math.max(1, ourBase - 2) : Math.max(1, oppBase - 2),
    centerB: teamAlliance === "blue" ? Math.max(1, ourBase - 2) : Math.max(1, oppBase - 2),
    partner: ["355V", "2055A", "169C", "1000A", "10K"][index % 5],
    opponentOne: ["169A", "32C", "96Z", "663A", "1468A"][index % 5],
    opponentTwo: ["227R", "10B", "471B", "886S", "1069A"][index % 5]
  };

  const setRobotCounts = (ours, theirs) => {
    seed.redRobots = teamAlliance === "red" ? ours : theirs;
    seed.blueRobots = teamAlliance === "blue" ? ours : theirs;
  };
  const setColoredPins = (ours, theirs) => {
    ["top", "right", "bottom", "left"].forEach(zone => {
      const prefix = zone;
      seed[`${prefix}${ourColor === "red" ? "R" : "B"}`] = Math.max(0, ours + (index + zone.length) % 2);
      seed[`${prefix}${opponentColor === "red" ? "R" : "B"}`] = Math.max(0, theirs + (index + zone.length + 1) % 2);
    });
  };

  if (scenario === "headAutonCode") {
    seed.auton = index % 3 === 0 ? opponentColor : index % 5 === 0 ? "tie" : ourColor;
    seed.centerY = 0;
    setRobotCounts(1, 1);
  } else if (scenario === "headHoldAuton") {
    seed.auton = index % 7 === 0 ? "tie" : ourColor;
    seed.centerY = 0;
    setRobotCounts(1, 1);
    if (index % 3 === 0) setColoredPins(2, 9);
  } else if (scenario === "headMidfield") {
    const controlled = index % 2 === 0;
    setRobotCounts(controlled ? 2 : 0, controlled ? 0 : 2);
    setColoredPins(controlled ? ourBase + 1 : ourBase - 1, controlled ? oppBase : oppBase + 2);
  } else if (scenario === "headYellow") {
    seed.centerY = 0;
    ["top", "right", "bottom", "left"].forEach((zone, zoneIndex) => {
      seed[`${zone}Y`] = 3;
      seed[`${zone}Toggle`] = (index + zoneIndex) % 2 === 0 ? ourColor : opponentColor;
    });
  } else if (scenario === "headToggleZone") {
    seed.topY = 4;
    seed.rightY = 1;
    seed.bottomY = 1;
    seed.leftY = 1;
    seed.topToggle = index % 5 < 3 ? opponentColor : ourColor;
  } else if (scenario === "headEndgame") {
    seed.auton = "tie";
    seed.topY = seed.rightY = seed.bottomY = seed.leftY = seed.centerY = 0;
    setColoredPins(5, 5);
    const missedFinish = index % 7 < 2;
    setRobotCounts(missedFinish ? 0 : 1, 1);
  } else if (scenario === "headPins") {
    seed.auton = "tie";
    seed.topY = seed.rightY = seed.bottomY = seed.leftY = seed.centerY = 0;
    setRobotCounts(2, 0);
    const strongPinMatch = index % 2 === 0;
    setColoredPins(strongPinMatch ? 7 : 3, strongPinMatch ? 3 : 7);
  }
  return seed;
}

function sampleSkillsSeed(index, total, skillsType, scenario, trajectoryShape, salt) {
  const progress = total <= 1 ? 1 : index / (total - 1);
  const daysAgoValue = Math.round((1 - progress) * (80 + Math.floor(seededRandom(salt + 1) * 36)) + (skillsType === "autonomous" ? 1 : 0));
  const noise = (seededRandom(salt + index * 5.21 + (skillsType === "driver" ? 11 : 29)) - .5) * .08;
  let route = sampleTrajectoryForm(progress, trajectoryShape, .5 + noise * 4);
  if (scenario === "skillsDriverRepeat") route = skillsType === "driver" ? (index % 5 < 2 ? .98 : .38) : .72 + noise;
  if (scenario === "skillsAutonRepeat") route = skillsType === "autonomous" ? (index % 5 < 2 ? 1 : .28) : .72 + noise;
  if (scenario === "skillsRouteGain") route = index % 5 < 2 ? (skillsType === "driver" ? 1 : .98) : (skillsType === "driver" ? .24 : .18);
  if (["skillsYellow", "skillsCenter", "skillsPlacement"].includes(scenario)) route = .74 + noise;
  if (scenario === "skillsEventSet") route = skillsType === "driver" && index === total - 1 ? 1.18 : .52 + noise;
  if (scenario === "skillsCeiling" || scenario === "skillsBalance") route = .76 + noise;
  const seed = {
    daysAgo: daysAgoValue,
    skillsType,
    centerToggle: true,
    topToggle: "blue",
    rightToggle: "blue",
    bottomToggle: "red",
    leftToggle: "red",
    topY: 1 + Math.floor(route * 2),
    topR: 0,
    topB: Math.floor(route * (skillsType === "driver" ? 6 : 4)),
    rightY: 1 + Math.floor(route * 2),
    rightR: 0,
    rightB: Math.floor(route * (skillsType === "driver" ? 5 : 3)),
    bottomY: 1 + Math.floor(route * 2),
    bottomR: Math.floor(route * (skillsType === "driver" ? 6 : 4)),
    bottomB: 0,
    leftY: 1 + Math.floor(route * 2),
    leftR: Math.floor(route * (skillsType === "driver" ? 5 : 3)),
    leftB: 0,
    centerY: 1 + Math.floor(route * 2),
    centerR: Math.floor(route * (skillsType === "driver" ? 3 : 2)),
    centerB: Math.floor(route * (skillsType === "driver" ? 3 : 2)),
    notes: route > .72
      ? `${skillsType === "driver" ? "Driver" : "Autonomous"} route is getting cleaner.`
      : `${skillsType === "driver" ? "Driver" : "Autonomous"} sample while tuning route.`
  };
  if (scenario === "skillsYellow") {
    seed.topToggle = "neutral";
    seed.rightToggle = "red";
    seed.bottomToggle = "neutral";
    seed.leftToggle = "blue";
  }
  if (scenario === "skillsCenter") seed.centerToggle = false;
  if (scenario === "skillsPlacement") {
    seed.topR = 5;
    seed.rightR = 4;
    seed.bottomB = 5;
    seed.leftB = 4;
  }
  return seed;
}

function createSampleHeadRecord(seed, token = Math.random()) {
  const savedAt = daysAgo(seed.daysAgo);
  const scorer = {
    auton: seed.auton,
    robots: {
      "red-1": seed.redRobots >= 1,
      "red-2": seed.redRobots >= 2,
      "blue-1": seed.blueRobots >= 1,
      "blue-2": seed.blueRobots >= 2
    },
    quadrants: sampleQuadrants(seed)
  };
  const redScore = scoreScorerSnapshot(scorer, "red");
  const blueScore = scoreScorerSnapshot(scorer, "blue");
  const ourScore = seed.teamAlliance === "red" ? redScore : blueScore;
  const opponentScore = seed.teamAlliance === "red" ? blueScore : redScore;

  return {
    id: `dev-head-${savedAt.getTime()}-${Math.floor(token * 0xFFFFFF).toString(16)}`,
    savedAt: savedAt.toISOString(),
    savedDate: sampleSavedDate(savedAt),
    teamNumber: profile?.teamNumber || "4330P",
    teamAlliance: seed.teamAlliance,
    redScore,
    blueScore,
    ourScore,
    opponentScore,
    result: matchResult(ourScore, opponentScore),
    scorer,
    details: {
      ...blankDetails(),
      partnerTeam: seed.partner || "",
      opponentOne: seed.opponentOne || "",
      opponentTwo: seed.opponentTwo || ""
    }
  };
}

function createSampleSkillsRecord(seed, token = Math.random()) {
  const savedAt = daysAgo(seed.daysAgo);
  const skills = {
    centerToggle: seed.centerToggle,
    toggles: {
      top: seed.topToggle,
      right: seed.rightToggle,
      bottom: seed.bottomToggle,
      left: seed.leftToggle
    },
    quadrants: {
      top: { yellow: seed.topY, red: seed.topR || 0, blue: seed.topB },
      right: { yellow: seed.rightY, red: seed.rightR || 0, blue: seed.rightB },
      bottom: { yellow: seed.bottomY, red: seed.bottomR, blue: seed.bottomB || 0 },
      left: { yellow: seed.leftY, red: seed.leftR, blue: seed.leftB || 0 },
      center: { yellow: seed.centerY, red: seed.centerR, blue: seed.centerB }
    }
  };

  return {
    id: `dev-skills-${savedAt.getTime()}-${Math.floor(token * 0xFFFFFF).toString(16)}`,
    mode: "skills",
    savedAt: savedAt.toISOString(),
    savedDate: sampleSavedDate(savedAt),
    teamNumber: profile?.teamNumber || "4330P",
    skillsType: seed.skillsType,
    score: scoreSkillsSnapshot(skills),
    skills,
    notes: seed.notes || ""
  };
}

const DEV_HEAD_SCENARIOS = [
  "headAutonCode",
  "headHoldAuton",
  "headMidfield",
  "headYellow",
  "headToggleZone",
  "headEndgame",
  "headPins"
];
const DEV_SKILLS_SCENARIOS = [
  "skillsBalance",
  "skillsDriverRepeat",
  "skillsAutonRepeat",
  "skillsRouteGain",
  "skillsYellow",
  "skillsCenter",
  "skillsPlacement",
  "skillsEventSet",
  "skillsCeiling"
];

function classifySavedTrajectory(records, getter) {
  const scores = records
    .slice()
    .sort((a, b) => recordTimestamp(a) - recordTimestamp(b))
    .map(record => numericValue(getter(record)));
  return globalThis.VexAnalysisCoach?.classifyTrajectory(scores) || {
    shape: "steady",
    tone: "flat",
    opening: average(scores),
    current: average(scores),
    delta: 0
  };
}

function trajectoryMatchesProfile(shape, profile) {
  if (profile === "improving") return shape === "strongUp" || shape === "gradualUp";
  if (profile === "recovery") return shape === "recovery";
  if (profile === "decline") return shape === "decline";
  return shape === "steady";
}

function createDevHeadCandidate(scenario, trajectoryProfile, random) {
  const salt = Math.floor(random() * 1000000) + 1;
  const count = 54 + Math.floor(random() * 25);
  return Array.from({ length: count }, (_, index) => createSampleHeadRecord(
    sampleHeadSeed(index, count, scenario, trajectoryProfile, salt),
    random()
  ));
}

function createDevSkillsCandidate(scenario, trajectoryProfile, random) {
  const salt = Math.floor(random() * 1000000) + 1;
  const driverCount = scenario === "skillsBalance" ? 18 : 24 + Math.floor(random() * 17);
  const autonCount = scenario === "skillsBalance" ? 3 : 24 + Math.floor(random() * 15);
  return [
    ...Array.from({ length: driverCount }, (_, index) => createSampleSkillsRecord(
      sampleSkillsSeed(index, driverCount, "driver", scenario, trajectoryProfile, salt),
      random()
    )),
    ...Array.from({ length: autonCount }, (_, index) => createSampleSkillsRecord(
      sampleSkillsSeed(index, autonCount, "autonomous", scenario, trajectoryProfile, salt + 137),
      random()
    ))
  ];
}

function buildVerifiedHeadScenario(scenario, trajectoryProfile, random) {
  let recommendationFallback = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const records = createDevHeadCandidate(scenario, trajectoryProfile, random);
    const selected = rankedHeadRecommendation(records);
    const trajectory = classifySavedTrajectory(records, record => record.ourScore);
    if (selected.recommendationKey === scenario && !recommendationFallback) {
      recommendationFallback = { records, selected, trajectory };
    }
    if (selected.recommendationKey === scenario && trajectoryMatchesProfile(trajectory.shape, trajectoryProfile)) {
      return { records, selected, trajectory, verified: true };
    }
  }
  return recommendationFallback || (() => {
    const records = createDevHeadCandidate(scenario, trajectoryProfile, random);
    return {
      records,
      selected: rankedHeadRecommendation(records),
      trajectory: classifySavedTrajectory(records, record => record.ourScore),
      verified: false
    };
  })();
}

function buildVerifiedSkillsScenario(scenario, trajectoryProfile, random) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const records = createDevSkillsCandidate(scenario, trajectoryProfile, random);
    const selected = rankedSkillsRecommendation(records);
    if (selected.recommendationKey === scenario) return { records, selected, verified: true };
  }
  const records = createDevSkillsCandidate(scenario, trajectoryProfile, random);
  return { records, selected: rankedSkillsRecommendation(records), verified: false };
}

function createJudgeHeadCandidate(salt) {
  const count = 50;
  const random = createDevRandom(433000 + salt);
  const preparedLosses = new Set([2, 5, 6, 9, 13, 15, 18, 22, 24, 27, 31, 34, 38, 43, 47]);
  const preparedAutonTies = new Set([4, 17, 32, 46]);
  return Array.from({ length: count }, (_, index) => {
    const seed = sampleHeadSeed(index, count, "headHoldAuton", "recovery", salt);
    const isPreparedDraw = index === 29;
    const progress = index / (count - 1);
    const setback = 11.5 * Math.exp(-Math.pow((progress - .55) / .14, 2));
    const variance = Math.round((seededRandom(salt + index * 11.7) - .5) * 3);
    const ourOuterTotal = Math.max(16, Math.round(19 + progress * 12 - setback) + variance);
    const ourColor = seed.teamAlliance === "red" ? "R" : "B";
    const opponentColor = seed.teamAlliance === "red" ? "B" : "R";
    const allianceName = seed.teamAlliance;
    const distributePins = (total, color) => {
      const zones = ["top", "right", "bottom", "left"];
      const base = Math.floor(total / zones.length);
      const remainder = total % zones.length;
      zones.forEach((zone, zoneIndex) => {
        seed[`${zone}${color}`] = base + (zoneIndex < remainder ? 1 : 0);
      });
    };

    seed.auton = isPreparedDraw || preparedAutonTies.has(index) ? "tie" : allianceName;
    seed.redRobots = 1;
    seed.blueRobots = 1;
    seed.centerY = 0;
    seed.centerR = 2;
    seed.centerB = 2;
    ["top", "right", "bottom", "left"].forEach((zone, zoneIndex) => {
      seed[`${zone}Toggle`] = allianceName;
      seed[`${zone}Y`] = zoneIndex === 0 ? 1 : 0;
    });

    if (!isPreparedDraw) {
      const autonAdvantage = seed.auton === allianceName ? POINTS.auton : 0;
      const yellowAdvantage = ["top", "right", "bottom", "left"]
        .reduce((total, zone) => total + seed[`${zone}Y`] * POINTS.yellowPin, 0);
      const baseAdvantage = autonAdvantage + yellowAdvantage;
      const marginVariation = (seededRandom(salt + index * 13.1) - .5) * 4;
      const targetMargin = Math.max(3, 19 - progress * 14 + marginVariation);
      const targetWinMargin = Math.min(24, 2 + progress * 20 + marginVariation);
      const opponentOuterTotal = preparedLosses.has(index)
        ? ourOuterTotal + Math.ceil((baseAdvantage + targetMargin) / POINTS.alliancePin)
        : Math.max(4, ourOuterTotal + Math.floor((baseAdvantage - targetWinMargin) / POINTS.alliancePin));
      distributePins(ourOuterTotal, ourColor);
      distributePins(opponentOuterTotal, opponentColor);
    } else {
      distributePins(ourOuterTotal, ourColor);
      distributePins(ourOuterTotal, opponentColor);
    }
    if (isPreparedDraw) {
      ["top", "right", "bottom", "left"].forEach((zone) => {
        seed[`${zone}Toggle`] = "neutral";
        seed[`${zone}Y`] = 0;
      });
    }
    return {
      ...createSampleHeadRecord(seed, random()),
      recordSource: "prepared-practice"
    };
  });
}

function createJudgeSkillsCandidate(salt) {
  const random = createDevRandom(433100 + salt);
  const driverCount = 18;
  const autonCount = 12;
  return [
    ...Array.from({ length: driverCount }, (_, index) => ({
      ...createSampleSkillsRecord(
        sampleSkillsSeed(index, driverCount, "driver", "skillsDriverRepeat", "recovery", salt),
        random()
      ),
      recordSource: "prepared-practice"
    })),
    ...Array.from({ length: autonCount }, (_, index) => ({
      ...createSampleSkillsRecord(
        sampleSkillsSeed(index, autonCount, "autonomous", "skillsDriverRepeat", "recovery", salt + 137),
        random()
      ),
      recordSource: "prepared-practice"
    }))
  ];
}

function buildJudgeDataset() {
  let headFallback = null;
  for (let salt = 4330; salt < 4530; salt += 1) {
    const records = createJudgeHeadCandidate(salt);
    const recommendation = rankedHeadRecommendation(records);
    const trajectory = classifySavedTrajectory(records, record => record.ourScore);
    const outcomes = new Set(records.map(record => record.result));
    const margins = records.map(record => numericValue(record.ourScore) - numericValue(record.opponentScore));
    const marginGrowth = average(margins.slice(-10)) - average(margins.slice(0, 10));
    const candidate = { records, recommendation, trajectory, marginGrowth };
    if (!headFallback && recommendation.recommendationKey === "headHoldAuton") headFallback = candidate;
    if (recommendation.recommendationKey === "headHoldAuton"
      && trajectory.shape === "recovery"
      && marginGrowth >= 10
      && ["win", "loss", "tie"].every(outcome => outcomes.has(outcome))) {
      headFallback = candidate;
      break;
    }
  }

  let skillsFallback = null;
  for (let salt = 7330; salt < 7530; salt += 1) {
    const records = createJudgeSkillsCandidate(salt);
    const recommendation = rankedSkillsRecommendation(records);
    const candidate = { records, recommendation };
    if (!skillsFallback) skillsFallback = candidate;
    if (recommendation.recommendationKey === "skillsDriverRepeat") {
      skillsFallback = candidate;
      break;
    }
  }

  const judgeOutcomeCounts = headFallback?.records.reduce((counts, record) => {
    counts[record.result] = (counts[record.result] || 0) + 1;
    return counts;
  }, {});
  if (!headFallback || !skillsFallback
    || headFallback.recommendation.recommendationKey !== "headHoldAuton"
    || headFallback.trajectory.shape !== "recovery"
    || headFallback.marginGrowth < 10
    || judgeOutcomeCounts?.win !== 34
    || judgeOutcomeCounts?.loss !== 15
    || judgeOutcomeCounts?.tie !== 1
    || skillsFallback.recommendation.recommendationKey !== "skillsDriverRepeat") {
    throw new Error("Prepared judge dataset did not validate against the recommendation engine.");
  }

  return [
    ...headFallback.records.map(record => ({ ...record, id: record.id.replace(/^dev-/, "judge-sample-") })),
    ...skillsFallback.records.map(record => ({ ...record, id: record.id.replace(/^dev-/, "judge-sample-") }))
  ];
}

function initializeJudgeWorkspace() {
  if (!isJudgeMode) return;
  document.body.classList.add("judge-mode");
  const notice = $("[data-judge-notice]");
  if (notice) notice.hidden = false;

  const previousProfile = loadProfile();
  profile = {
    teamNumber: "4330P",
    teamName: "RoboPigeons",
    teamSource: "synced-events",
    createdAt: previousProfile?.createdAt || new Date().toISOString()
  };
  localStorage.setItem(JUDGE_PROFILE_STORE_KEY, JSON.stringify(profile));

  if (localStorage.getItem(JUDGE_DATASET_VERSION_STORE_KEY) !== JUDGE_DATASET_VERSION) {
    localStorage.setItem(JUDGE_MATCH_STORE_KEY, JSON.stringify(buildJudgeDataset()));
    localStorage.removeItem(JUDGE_COMPETITION_STORE_KEY);
    localStorage.setItem(JUDGE_DATASET_VERSION_STORE_KEY, JUDGE_DATASET_VERSION);
  }
  importedCompetition = loadCompetitionData();
}

function devRecommendationLabel(key) {
  const guide = coachGuides[currentLanguage]?.[key] || coachGuides.en[key];
  return String(guide?.title || key || "--")
    .replace(/\{zone\}/g, t("quadrant.top"))
    .replace(/\{route\}/g, t("tabs.skills"))
    .replace(/\{color\}/g, t("color.red").toLowerCase());
}

function trajectoryShapeLabel(shape) {
  const keys = {
    strongUp: "analysis.story.timelineStrongUp",
    gradualUp: "analysis.story.timelineUp",
    recovery: "analysis.story.timelineRecovery",
    decline: "analysis.story.timelineDown",
    steady: "analysis.story.timelineFlat"
  };
  return t(keys[shape] || keys.steady);
}

function renderDevDiagnostics() {
  const mount = $("[data-dev-diagnostics]");
  if (!mount) return;
  const diagnostics = devAutofillState.diagnostics;
  mount.hidden = !isDevMode || !diagnostics;
  if (mount.hidden) return;
  const mismatch = diagnostics.headTarget !== diagnostics.headSelected
    || diagnostics.skillsTarget !== diagnostics.skillsSelected;
  mount.classList.toggle("is-mismatch", mismatch);
  const pair = (headKey, skillsKey) => `${t("tabs.head")}: ${devRecommendationLabel(headKey)} / ${t("tabs.skills")}: ${devRecommendationLabel(skillsKey)}`;
  mount.innerHTML = `
    <span><small>${escapeHtml(t("dev.generatedScenario"))}</small><strong>${escapeHtml(pair(diagnostics.headTarget, diagnostics.skillsTarget))}</strong></span>
    <span><small>${escapeHtml(t(mismatch ? "dev.selectorMismatch" : "dev.coachSelected"))}</small><strong>${escapeHtml(pair(diagnostics.headSelected, diagnostics.skillsSelected))}</strong></span>
    <span><small>${escapeHtml(t("dev.seasonShape"))}</small><strong>${escapeHtml(trajectoryShapeLabel(diagnostics.trajectoryShape))}</strong></span>`;
}

function seedSampleData(seed = Date.now()) {
  const random = createDevRandom(seed);
  const headTarget = chooseDevScenario(DEV_HEAD_SCENARIOS, lastDevHeadRecommendation, random);
  const skillsTarget = chooseDevScenario(DEV_SKILLS_SCENARIOS, lastDevSkillsRecommendation, random);
  const trajectoryProfile = chooseDevTrajectory(random);
  const head = buildVerifiedHeadScenario(headTarget, trajectoryProfile, random);
  const skills = buildVerifiedSkillsScenario(skillsTarget, trajectoryProfile, random);

  lastDevHeadRecommendation = head.selected.recommendationKey;
  lastDevSkillsRecommendation = skills.selected.recommendationKey;
  saveDevAutofillState({
    headRecommendation: lastDevHeadRecommendation,
    skillsRecommendation: lastDevSkillsRecommendation,
    diagnostics: {
      headTarget,
      headSelected: lastDevHeadRecommendation,
      skillsTarget,
      skillsSelected: lastDevSkillsRecommendation,
      trajectoryShape: head.trajectory.shape,
      generatedAt: new Date().toISOString()
    }
  });

  const nextMatches = [
    ...savedMatches().filter(record => !String(record.id || "").startsWith("dev-")),
    ...head.records,
    ...skills.records
  ];
  writeSavedMatches(nextMatches);
  renderHistory();
  renderSkillsHistory();
  renderAnalysis();
  renderDevDiagnostics();
  showToast(t("toast.sampleRebuilt"));
}

function showToast(message) {
  const toast = $("[data-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function openSaveModal() {
  if (teamAlliance !== "red" && teamAlliance !== "blue") {
    showToast(t("toast.chooseAlliance"));
    return;
  }

  const modal = $("[data-save-modal]");
  const form = $("[data-save-form]");
  if (!modal || !form) return;
  lastModalFocus = document.activeElement;
  form.reset();
  modal.hidden = false;
  document.body.classList.add("modal-open");
  form.elements.partnerTeam?.focus();
}

function closeSaveModal() {
  const modal = $("[data-save-modal]");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (lastModalFocus && typeof lastModalFocus.focus === "function") {
    lastModalFocus.focus();
  }
}

function openSkillsSaveModal() {
  if (skillsRunType !== "driver" && skillsRunType !== "autonomous") {
    showToast(t("toast.chooseSkillsType"));
    return;
  }

  const modal = $("[data-skills-save-modal]");
  const form = $("[data-skills-save-form]");
  if (!modal || !form) return;
  lastModalFocus = document.activeElement;
  form.reset();
  modal.hidden = false;
  document.body.classList.add("modal-open");
  form.elements.notes?.focus();
}

function closeSkillsSaveModal() {
  const modal = $("[data-skills-save-modal]");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  if (lastModalFocus && typeof lastModalFocus.focus === "function") {
    lastModalFocus.focus();
  }
}

function saveCurrentMatch(details) {
  if (teamAlliance !== "red" && teamAlliance !== "blue") {
    showToast(t("toast.chooseAlliance"));
    return;
  }

  const record = createMatchRecord(details);
  const matches = savedMatches();
  matches.push(record);

  try {
    writeSavedMatches(matches);
  } catch {
    showToast(t("toast.matchSaveFailed"));
    return;
  }

  closeSaveModal();
  resetScorer();
  renderHistory();
  renderAnalysis();
  showToast(t("toast.matchSaved"));
}

function saveCurrentSkillsRun(notes = "") {
  if (skillsRunType !== "driver" && skillsRunType !== "autonomous") {
    showToast(t("toast.chooseSkillsType"));
    return;
  }

  const record = createSkillsRunRecord(notes);
  const matches = savedMatches();
  matches.push(record);

  try {
    writeSavedMatches(matches);
  } catch {
    showToast(t("toast.skillsSaveFailed"));
    return;
  }

  closeSkillsSaveModal();
  resetSkillsScorer();
  renderSkillsHistory();
  renderAnalysis();
  showToast(t("toast.skillsSaved"));
}

function setTeamAlliance(alliance) {
  teamAlliance = teamAlliance === alliance ? "none" : alliance;
  render();
}

function openSetupModal() {
  const modal = $("[data-setup-modal]");
  const form = $("[data-setup-form]");
  if (!modal || !form) return;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  form.elements.teamNumber?.focus();
}

function closeSetupModal() {
  const modal = $("[data-setup-modal]");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

function initializeProfileGate() {
  if (!profile && !isJudgeMode) {
    openSetupModal();
  }
}

function setMode(mode) {
  activeMode = ["head", "skills", "scouting", "analysis"].includes(mode) ? mode : "head";
  renderMode();
}

function renderMode() {
  document.body.classList.toggle("analysis-active", activeMode === "analysis");
  $$("[data-mode-choice]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.modeChoice === activeMode));
  });

  $$("[data-mode-section]").forEach((section) => {
    const isActive = section.dataset.modeSection === activeMode;
    section.hidden = !isActive;
    section.classList.toggle("is-active-mode-section", isActive);
  });
  if (activeMode === "analysis") requestAnimationFrame(initReplayMotion);
}

function renderSkills() {
  $$("[data-skills-counter]").forEach((output) => {
    const [quadrant, color] = output.dataset.skillsCounter.split(":");
    output.textContent = skillsState.quadrants[quadrant]?.[color] ?? 0;
  });

  $$("[data-skills-center-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(skillsState.centerToggle));
  });

  $$("[data-skills-toggle]").forEach((button) => {
    const quadrant = button.dataset.skillsToggle;
    const value = skillsState.toggles[quadrant] || "neutral";
    button.className = `toggle toggle-${quadrant} ${value} skills-side-toggle`;
    button.setAttribute("aria-label", `Skills ${quadrant} toggle ${value}`);
  });

  $$("[data-skills-score]").forEach((score) => {
    score.textContent = scoreSkills();
  });

  $$("[data-skills-type]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.skillsType === skillsRunType));
  });
}

function render() {
  $("#redTotal").textContent = scoreAlliance("red");
  $("#blueTotal").textContent = scoreAlliance("blue");
  $$("[data-auton]").forEach((button) => {
    const color = button.dataset.auton;
    const active = state.auton === color || state.auton === "tie";
    button.setAttribute("aria-pressed", String(active));
  });

  $$("[data-toggle]").forEach((button) => {
    const quadrant = button.dataset.toggle;
    const value = state.quadrants[quadrant].toggle;
    button.className = `toggle toggle-${quadrant} ${value}`;
    button.setAttribute("aria-label", `${quadrant} toggle ${value}`);
  });

  $$("[data-counter]").forEach((counter) => {
    const [quadrant, color] = counter.dataset.counter.split(":");
    counter.querySelector("output").textContent = state.quadrants[quadrant][color];
  });

  $$("[data-robot]").forEach((button) => {
    button.setAttribute("aria-pressed", String(state.robots[button.dataset.robot]));
  });

  $$("[data-team-alliance]").forEach((button) => {
    const active = button.dataset.teamAlliance === teamAlliance;
    button.setAttribute("aria-pressed", String(active));
  });

  $(".midfield-diamond").dataset.owner = midfieldOwner();
}

function sortedSavedMatches() {
  return savedMatches().sort((a, b) => {
    const bTime = new Date(b.savedAt || 0).getTime();
    const aTime = new Date(a.savedAt || 0).getTime();
    return bTime - aTime;
  });
}

function sortedHeadMatches() {
  return sortedSavedMatches().filter(isHeadMatch);
}

function sortedSkillsRuns() {
  return sortedSavedMatches().filter(isSkillsRun);
}

function recordTimestamp(record) {
  const timestamp = new Date(record?.savedAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function localDayStart(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dateInputStart(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function dateInputEnd(value) {
  const start = dateInputStart(value);
  if (!start) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
}

function analysisRangeBounds() {
  const today = localDayStart();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (analysisRange === "today") {
    return { start: today, end: tomorrow };
  }

  if (analysisRange === "7" || analysisRange === "30") {
    const days = Number(analysisRange);
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    return { start, end: tomorrow };
  }

  if (analysisRange === "custom") {
    return {
      start: dateInputStart($("[data-analysis-start]")?.value || ""),
      end: dateInputEnd($("[data-analysis-end]")?.value || "")
    };
  }

  return { start: null, end: null };
}

function filterAnalysisRecords(records) {
  const { start, end } = analysisRangeBounds();
  const startTime = start ? start.getTime() : null;
  const endTime = end ? end.getTime() : null;

  return records.filter((record) => {
    const timestamp = recordTimestamp(record);
    if (!timestamp) return false;
    if (startTime !== null && timestamp < startTime) return false;
    if (endTime !== null && timestamp >= endTime) return false;
    return true;
  });
}

function average(values) {
  const numbers = values.filter(value => Number.isFinite(value));
  if (!numbers.length) return null;
  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

function median(values) {
  const numbers = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  if (numbers.length % 2) return numbers[middle];
  return (numbers[middle - 1] + numbers[middle]) / 2;
}

function formatAnalysisNumber(value, suffix = "") {
  if (!Number.isFinite(value)) return "--";
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${formatted}${suffix}`;
}

function analysisScoreStats(records, scoreGetter) {
  const scoredRecords = records
    .map(record => ({ record, score: numericValue(scoreGetter(record)) }))
    .filter(item => Number.isFinite(item.score));
  const values = scoredRecords.map(item => item.score);
  const recentValues = scoredRecords
    .slice()
    .sort((a, b) => recordTimestamp(b.record) - recordTimestamp(a.record))
    .slice(0, 5)
    .map(item => item.score);

  return {
    count: values.length,
    mean: average(values),
    best: values.length ? Math.max(...values) : null,
    worst: values.length ? Math.min(...values) : null,
    median: median(values),
    recentMean: average(recentValues),
    recentCount: recentValues.length
  };
}

function percentile(values, amount) {
  const numbers = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!numbers.length) return null;
  const index = (numbers.length - 1) * amount;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return numbers[lower];
  return numbers[lower] + (numbers[upper] - numbers[lower]) * (index - lower);
}

function analysisStat(label, value, detail = "") {
  return `
    <div class="analysis-stat">
      <span>${label}</span>
      <strong>${value}</strong>
      ${detail ? `<small>${detail}</small>` : ""}
    </div>
  `;
}

function recentFormDetail(stats) {
  if (!Number.isFinite(stats.recentMean) || !Number.isFinite(stats.mean)) return "";
  const delta = stats.recentMean - stats.mean;
  const sign = delta > 0 ? "+" : "";
  return t("analysis.recentDetail", { count: stats.recentCount, delta: `${sign}${formatAnalysisNumber(delta)}` });
}

function analysisInsightCard(title, body, stat = "", extraClass = "") {
  return `
    <div class="analysis-insight-card ${escapeHtml(extraClass)}">
      <span>${escapeHtml(title)}</span>
      ${stat ? `<strong>${escapeHtml(stat)}</strong>` : ""}
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

function analysisMiniRow(label, value, detail = "") {
  return `
    <div class="analysis-mini-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </div>
  `;
}

function analysisSectionTitle(question, detail = "") {
  return `
    <div class="analysis-section-title">
      <span>${escapeHtml(question)}</span>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </div>
  `;
}

function analysisCoachNote(message) {
  return `
    <strong>${escapeHtml(t("analysis.coachNote"))}</strong>
    <span>${escapeHtml(message)}</span>
  `;
}

function renderAnalysisMode() {
  $$("[data-analysis-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.analysisMode === analysisMode));
  });

  $$("[data-analysis-section]").forEach((section) => {
    const isActive = section.dataset.analysisSection === analysisMode;
    section.hidden = !isActive;
    section.classList.toggle("is-active-analysis-section", isActive);
  });
}

function renderAnalysisRange() {
  $$("[data-analysis-range]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.analysisRange === analysisRange));
  });

  const custom = $("[data-analysis-custom]");
  if (custom) custom.hidden = analysisRange !== "custom";
}

function ourAlliancePins(match) {
  const alliance = match.teamAlliance;
  if (alliance !== "red" && alliance !== "blue") return null;
  const scorer = match.scorer || {};
  return quadrants.reduce((total, quadrant) => {
    const q = scorer.quadrants?.[quadrant] || {};
    return total + numericValue(q[alliance]);
  }, 0);
}

function opponentAlliance(match) {
  if (match.teamAlliance === "red") return "blue";
  if (match.teamAlliance === "blue") return "red";
  return null;
}

function quadrantData(record, quadrant) {
  return record?.scorer?.quadrants?.[quadrant] || {};
}

function quadrantPins(record, quadrant) {
  const q = quadrantData(record, quadrant);
  return colors.reduce((total, color) => total + numericValue(q[color]), 0);
}

function alliancePinsInQuadrant(match, quadrant, alliance = match.teamAlliance) {
  if (alliance !== "red" && alliance !== "blue") return null;
  return numericValue(quadrantData(match, quadrant)[alliance]);
}

function yellowPinsInQuadrant(match, quadrant) {
  return numericValue(quadrantData(match, quadrant).yellow);
}

function ownedYellowPinsInQuadrant(match, quadrant, alliance = match.teamAlliance) {
  if (alliance !== "red" && alliance !== "blue") return null;
  const q = quadrantData(match, quadrant);
  const owner = quadrant === "center" ? midpointOwnerFromRobots(match.scorer?.robots || {}) : q.toggle;
  return owner === alliance ? numericValue(q.yellow) : 0;
}

function yellowPins(match) {
  return quadrants.reduce((total, quadrant) => total + yellowPinsInQuadrant(match, quadrant), 0);
}

function totalRedBluePins(match) {
  return quadrants.reduce((total, quadrant) => {
    const q = quadrantData(match, quadrant);
    return total + numericValue(q.red) + numericValue(q.blue);
  }, 0);
}

function totalPins(match) {
  return quadrants.reduce((total, quadrant) => total + quadrantPins(match, quadrant), 0);
}

function opponentAlliancePins(match) {
  const alliance = opponentAlliance(match);
  if (!alliance) return null;
  const scorer = match.scorer || {};
  return quadrants.reduce((total, quadrant) => {
    const q = scorer.quadrants?.[quadrant] || {};
    return total + numericValue(q[alliance]);
  }, 0);
}

function opponentOwnedYellowPins(match) {
  return ownedYellowPins(match, opponentAlliance(match));
}

function ownedYellowPins(match, alliance = match.teamAlliance) {
  if (alliance !== "red" && alliance !== "blue") return null;
  const scorer = match.scorer || {};
  const centerOwner = midpointOwnerFromRobots(scorer.robots || {});
  return quadrants.reduce((total, quadrant) => {
    const q = scorer.quadrants?.[quadrant] || {};
    const owner = quadrant === "center" ? centerOwner : q.toggle;
    return owner === alliance ? total + numericValue(q.yellow) : total;
  }, 0);
}

function outerToggleOwnedCount(match, alliance = match.teamAlliance) {
  if (alliance !== "red" && alliance !== "blue") return null;
  return ["top", "right", "bottom", "left"].reduce((total, quadrant) => {
    return total + (match.scorer?.quadrants?.[quadrant]?.toggle === alliance ? 1 : 0);
  }, 0);
}

function centerControlledByUs(match) {
  return midpointOwnerFromRobots(match.scorer?.robots || {}) === match.teamAlliance ? 1 : 0;
}

function ourMidfieldRobots(match) {
  const alliance = match.teamAlliance;
  if (alliance !== "red" && alliance !== "blue") return null;
  return Object.entries(match.scorer?.robots || {}).reduce((total, [robotId, active]) => {
    return active && robotId.startsWith(alliance) ? total + 1 : total;
  }, 0);
}

function opponentMidfieldRobots(match) {
  const alliance = opponentAlliance(match);
  if (!alliance) return null;
  return Object.entries(match.scorer?.robots || {}).reduce((total, [robotId, active]) => {
    return active && robotId.startsWith(alliance) ? total + 1 : total;
  }, 0);
}

function autonPoints(match) {
  const auton = match.scorer?.auton || match.auton;
  const alliance = match.teamAlliance;
  if (auton === "tie") return POINTS.autonTie;
  if (auton === alliance) return POINTS.auton;
  return 0;
}

function autonWon(match) {
  return (match.scorer?.auton || match.auton) === match.teamAlliance ? 1 : 0;
}

function autonLost(match) {
  return (match.scorer?.auton || match.auton) === opponentAlliance(match) ? 1 : 0;
}

function autonTied(match) {
  return (match.scorer?.auton || match.auton) === "tie" ? 1 : 0;
}

function skillsRedBluePins(run) {
  const q = run.skills?.quadrants || {};
  return skillsQuadrants.reduce((total, quadrant) => {
    return total + numericValue(q[quadrant]?.red) + numericValue(q[quadrant]?.blue);
  }, 0);
}

function skillsColorPins(run, color) {
  const q = run.skills?.quadrants || {};
  return skillsQuadrants.reduce((total, quadrant) => total + numericValue(q[quadrant]?.[color]), 0);
}

function skillsPinsInQuadrant(run, quadrant) {
  const q = run.skills?.quadrants?.[quadrant] || {};
  return colors.reduce((total, color) => total + numericValue(q[color]), 0);
}

function skillsYellowPins(run) {
  const q = run.skills?.quadrants || {};
  return skillsQuadrants.reduce((total, quadrant) => total + numericValue(q[quadrant]?.yellow), 0);
}

function skillsScoredYellowPins(run) {
  const q = run.skills?.quadrants || {};
  const toggles = run.skills?.toggles || {};
  let total = 0;
  if (toggles.left === "red") total += numericValue(q.left?.yellow);
  if (toggles.bottom === "red") total += numericValue(q.bottom?.yellow);
  if (toggles.top === "blue") total += numericValue(q.top?.yellow);
  if (toggles.right === "blue") total += numericValue(q.right?.yellow);
  if (run.skills?.centerToggle) total += numericValue(q.center?.yellow);
  return total;
}

function skillsTotalPins(run) {
  return skillsQuadrants.reduce((total, quadrant) => total + skillsPinsInQuadrant(run, quadrant), 0);
}

function skillsCorrectYellowOwnership(run) {
  const toggles = run.skills?.toggles || {};
  let total = 0;
  if (toggles.left === "red") total += 1;
  if (toggles.bottom === "red") total += 1;
  if (toggles.top === "blue") total += 1;
  if (toggles.right === "blue") total += 1;
  if (run.skills?.centerToggle) total += 1;
  return total;
}

function skillsMissedYellowPins(run) {
  return skillsYellowPins(run) - skillsScoredYellowPins(run);
}

const headCorrelationOptions = [
  {
    group: "Score",
    options: [
      { key: "ourScore", label: "Our score", get: match => numericValue(match.ourScore) },
      { key: "opponentScore", label: "Opponent score", get: match => numericValue(match.opponentScore) },
      { key: "margin", label: "Score margin", get: match => numericValue(match.ourScore) - numericValue(match.opponentScore) },
      { key: "totalMatchScore", label: "Total match score", get: match => numericValue(match.redScore) + numericValue(match.blueScore) },
      { key: "win", label: "Win result", get: match => match.result === "win" ? 1 : match.result === "loss" ? 0 : .5 }
    ]
  },
  {
    group: "Pins",
    options: [
      { key: "alliancePins", label: "Our red/blue pins", get: ourAlliancePins },
      { key: "opponentPins", label: "Opponent red/blue pins", get: opponentAlliancePins },
      { key: "totalRedBluePins", label: "Total red + blue pins", get: totalRedBluePins },
      { key: "totalPins", label: "Total pins placed", get: totalPins },
      { key: "ownedYellow", label: "Our owned yellow pins", get: match => ownedYellowPins(match) },
      { key: "opponentOwnedYellow", label: "Opponent owned yellow pins", get: opponentOwnedYellowPins },
      { key: "yellowPins", label: "Yellow pins placed", get: yellowPins }
    ]
  },
  {
    group: "Zones",
    options: [
      ...["top", "right", "bottom", "left", "center"].flatMap(quadrant => [
        { key: `${quadrant}TotalPins`, label: `${capitalize(quadrant)} zone total pins`, get: match => quadrantPins(match, quadrant) },
        { key: `${quadrant}OurPins`, label: `Our pins in ${quadrant}`, get: match => alliancePinsInQuadrant(match, quadrant) },
        { key: `${quadrant}OpponentPins`, label: `Opponent pins in ${quadrant}`, get: match => alliancePinsInQuadrant(match, quadrant, opponentAlliance(match)) },
        { key: `${quadrant}OwnedYellow`, label: `Owned yellow pins in ${quadrant}`, get: match => ownedYellowPinsInQuadrant(match, quadrant) }
      ])
    ]
  },
  {
    group: "Control",
    options: [
      { key: "ourOuterToggles", label: "Our outer toggles owned", get: match => outerToggleOwnedCount(match) },
      { key: "opponentOuterToggles", label: "Opponent outer toggles owned", get: match => outerToggleOwnedCount(match, opponentAlliance(match)) },
      { key: "centerControl", label: "Center controlled by us", get: centerControlledByUs },
      { key: "midfieldRobots", label: "Our midfield robots", get: ourMidfieldRobots },
      { key: "opponentMidfieldRobots", label: "Opponent midfield robots", get: opponentMidfieldRobots }
    ]
  },
  {
    group: "Autonomous",
    options: [
      { key: "autonPoints", label: "Auton points", get: autonPoints },
      { key: "autonWon", label: "Won auton", get: autonWon },
      { key: "autonLost", label: "Lost auton", get: autonLost },
      { key: "autonTied", label: "Tied auton", get: autonTied }
    ]
  }
];

const skillsCorrelationOptions = [
  {
    group: "Score",
    options: [
      { key: "score", label: "Skills score", get: run => numericValue(run.score) },
      { key: "driverRun", label: "Driver run", get: run => run.skillsType === "driver" ? 1 : 0 },
      { key: "autonRun", label: "Autonomous run", get: run => run.skillsType === "autonomous" ? 1 : 0 }
    ]
  },
  {
    group: "Pins",
    options: [
      { key: "redBluePins", label: "Total red + blue pins", get: skillsRedBluePins },
      { key: "redPins", label: "Red pins scored", get: run => skillsColorPins(run, "red") },
      { key: "bluePins", label: "Blue pins scored", get: run => skillsColorPins(run, "blue") },
      { key: "yellowPins", label: "Yellow pins placed", get: skillsYellowPins },
      { key: "scoredYellow", label: "Yellow pins scored", get: skillsScoredYellowPins },
      { key: "totalPins", label: "Total pins placed", get: skillsTotalPins }
    ]
  },
  {
    group: "Zones",
    options: skillsQuadrants.map(quadrant => ({
      key: `${quadrant}Pins`,
      label: `${capitalize(quadrant)} zone pins`,
      get: run => skillsPinsInQuadrant(run, quadrant)
    }))
  },
  {
    group: "Control",
    options: [
      { key: "midfield", label: "Center toggle active", get: run => run.skills?.centerToggle ? 1 : 0 },
      { key: "correctYellowOwnership", label: "Correct yellow ownership count", get: skillsCorrectYellowOwnership },
      { key: "missedYellowPins", label: "Missed yellow pins", get: skillsMissedYellowPins }
    ]
  }
];

function flatCorrelationOptions(groups) {
  return groups.flatMap(group => group.options);
}

function correlationOptionLabel(option) {
  const exact = tt(`analysis.correlationOption.${option.key}`, "");
  if (exact) return exact;
  const zoneMatch = String(option.key).match(/^(top|right|bottom|left|center)(TotalPins|OurPins|OpponentPins|OwnedYellow|Pins)$/);
  if (zoneMatch) {
    return t(`analysis.zoneOption.${zoneMatch[2]}`, { quadrant: t(`quadrant.${zoneMatch[1]}`) });
  }
  return option.label;
}

function correlationOptionsHtml(groups, selected) {
  return groups.map(group => `
    <optgroup label="${escapeHtml(tt(`analysis.correlationGroup.${group.group.toLowerCase()}`, group.group))}">
      ${group.options.map(option => `
        <option value="${escapeHtml(option.key)}" ${option.key === selected ? "selected" : ""}>${escapeHtml(correlationOptionLabel(option))}</option>
      `).join("")}
    </optgroup>
  `).join("");
}

function pearsonCorrelation(pairs) {
  if (pairs.length < 3) return null;
  const xs = pairs.map(pair => pair.x);
  const ys = pairs.map(pair => pair.y);
  const meanX = average(xs);
  const meanY = average(ys);
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  pairs.forEach(({ x, y }) => {
    const dx = x - meanX;
    const dy = y - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  });
  const denominator = Math.sqrt(denomX * denomY);
  if (!denominator) return null;
  return numerator / denominator;
}

function correlationLabel(value) {
  if (!Number.isFinite(value)) return t("analysis.correlation.notEnough");
  const strength = Math.abs(value);
  const direction = value > 0 ? "Positive" : value < 0 ? "Negative" : "";
  if (strength >= .75) return t(`analysis.correlation.strong${direction}`);
  if (strength >= .45) return t(`analysis.correlation.moderate${direction}`);
  if (strength >= .22) return t(`analysis.correlation.weak${direction}`);
  return t("analysis.correlation.little");
}

function correlationValue(records, optionX, optionY) {
  const pairs = records
    .map(record => ({ x: numericValue(optionX.get(record)), y: numericValue(optionY.get(record)) }))
    .filter(pair => Number.isFinite(pair.x) && Number.isFinite(pair.y));
  return { r: pearsonCorrelation(pairs), count: pairs.length };
}

function renderCorrelation(records, options, selectedX, selectedY, mode) {
  const flatOptions = flatCorrelationOptions(options);
  const optionX = flatOptions.find(option => option.key === selectedX) || flatOptions[0];
  const optionY = flatOptions.find(option => option.key === selectedY) || flatOptions[1] || flatOptions[0];
  const { r, count } = correlationValue(records, optionX, optionY);
  const prettyR = Number.isFinite(r) ? r.toFixed(2) : "--";

  return `
    <details class="analysis-correlation-lab" ${analysisDisclosureState[mode].correlation ? "open" : ""}>
      <summary>
        <span>${escapeHtml(t("analysis.openCorrelation"))}</span>
        <small>${escapeHtml(t("analysis.correlationTool"))}</small>
      </summary>
      <div class="analysis-correlation-body">
        <div class="analysis-correlation-controls">
          <label>
            <span>${escapeHtml(t("analysis.compare"))}</span>
            <select data-correlation-axis="${mode}:x">${correlationOptionsHtml(options, optionX.key)}</select>
          </label>
          <label>
            <span>${escapeHtml(t("analysis.against"))}</span>
            <select data-correlation-axis="${mode}:y">${correlationOptionsHtml(options, optionY.key)}</select>
          </label>
        </div>
        <div class="analysis-correlation-result">
          <strong>${correlationLabel(r)}</strong>
          <span>${escapeHtml(t("analysis.correlationResult", { r: prettyR, count, type: mode === "head" ? t("analysis.matchesLabel") : t("analysis.runsLabel") }))}</span>
          <small>${escapeHtml(t("analysis.correlationHelp"))}</small>
        </div>
      </div>
    </details>
  `;
}

function scoreGetterValues(records, getter) {
  return records
    .map(record => numericValue(getter(record)))
    .filter(value => Number.isFinite(value));
}

function resultAverage(records, getter) {
  return average(scoreGetterValues(records, getter));
}

function averageObject(items, key) {
  return average(items.map(item => numericValue(item[key])).filter(value => Number.isFinite(value)));
}

function percentRate(part, total) {
  return total ? (part / total) * 100 : null;
}

function scoreMargin(match) {
  return numericValue(match.ourScore) - numericValue(match.opponentScore);
}

function signedNumber(value, suffix = "") {
  if (!Number.isFinite(value)) return "--";
  return `${value > 0 ? "+" : ""}${formatAnalysisNumber(value, suffix)}`;
}

function formatRate(value) {
  return formatAnalysisNumber(value, "%");
}

function yellowEfficiencyValue(matches) {
  const placed = matches.reduce((total, match) => total + yellowPins(match), 0);
  const scored = matches.reduce((total, match) => total + numericValue(ownedYellowPins(match)), 0);
  return { placed, scored, rate: placed ? (scored / placed) * 100 : null };
}

function skillsYellowEfficiencyValue(runs) {
  const placed = runs.reduce((total, run) => total + skillsYellowPins(run), 0);
  const scored = runs.reduce((total, run) => total + skillsScoredYellowPins(run), 0);
  return { placed, scored, rate: placed ? (scored / placed) * 100 : null };
}

function renderStoryHero(recommendation) {
  return `
    <section class="analysis-story-hero">
      <span>${escapeHtml(t("analysis.story.theStoryNow"))}</span>
      <h4>${escapeHtml(recommendation.title)}</h4>
      <p>${escapeHtml(recommendation.why)}</p>
      <div class="analysis-story-proof">
        <div>
          <small>${escapeHtml(t("analysis.story.proof"))}</small>
          <strong>${escapeHtml(recommendation.proof)}</strong>
        </div>
        <div>
          <small>${escapeHtml(t("analysis.story.nextTarget"))}</small>
          <strong>${escapeHtml(recommendation.target)}</strong>
        </div>
      </div>
    </section>
  `;
}

function renderProofGrid(cards) {
  return `
    <div class="analysis-phase-rail" aria-label="${escapeHtml(t("analysis.story.matchPhases"))}">
      ${cards.map(card => `
        <article class="analysis-phase-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <p>${escapeHtml(card.detail)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderNumberStrip(items) {
  return `
    <div class="analysis-number-strip">
      ${items.map(item => analysisStat(item.label, item.value, item.detail)).join("")}
    </div>
  `;
}

function renderMapMetric(label, value, detail = "") {
  return `
    <div class="analysis-map-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </div>
  `;
}

function renderHeadStrategyMap(matches) {
  const autonRate = percentRate(matches.filter(autonWon).length, matches.length);
  const centerRate = percentRate(matches.filter(centerControlledByUs).length, matches.length);
  const yellow = yellowEfficiencyValue(matches);
  const pinAverage = resultAverage(matches, ourAlliancePins);
  const margin = resultAverage(matches, scoreMargin);
  return `
    <section class="analysis-strategy-map">
      <div class="analysis-map-copy">
        <span>${escapeHtml(t("analysis.story.strategyMap"))}</span>
        <h4>${escapeHtml(t("analysis.story.strategyMapHead"))}</h4>
        <p>${escapeHtml(t("analysis.story.strategyMapDetail"))}</p>
        <div class="analysis-map-metrics">
          ${renderMapMetric(t("analysis.story.mapAuton"), formatRate(autonRate), t("analysis.wonAuton"))}
          ${renderMapMetric(t("analysis.story.mapCenter"), formatRate(centerRate), t("analysis.centerImpact"))}
          ${renderMapMetric(t("analysis.story.mapYellows"), formatRate(yellow.rate), t("analysis.yellowEfficiencyDetail", { scored: yellow.scored, placed: yellow.placed }))}
          ${renderMapMetric(t("analysis.story.mapPins"), formatAnalysisNumber(pinAverage), t("analysis.correlationOption.alliancePins"))}
          ${renderMapMetric(t("analysis.story.mapMargin"), signedNumber(margin), t("analysis.correlationOption.margin"))}
        </div>
      </div>
      <div class="analysis-field-map" aria-hidden="true">
        <div class="analysis-field-zone top ${autonRate >= 50 ? "good" : "needs"}"><b>${escapeHtml(t("analysis.story.mapAuton"))}</b><span>${escapeHtml(formatRate(autonRate))}</span></div>
        <div class="analysis-field-zone left ${yellow.rate >= 75 ? "good" : "needs"}"><b>${escapeHtml(t("analysis.story.mapYellows"))}</b><span>${escapeHtml(formatRate(yellow.rate))}</span></div>
        <div class="analysis-field-zone center ${centerRate >= 55 ? "good" : "needs"}"><b>${escapeHtml(t("analysis.story.mapCenter"))}</b><span>${escapeHtml(formatRate(centerRate))}</span></div>
        <div class="analysis-field-zone right ${pinAverage >= 12 ? "good" : "needs"}"><b>${escapeHtml(t("analysis.story.mapPins"))}</b><span>${escapeHtml(formatAnalysisNumber(pinAverage))}</span></div>
        <div class="analysis-field-zone bottom ${margin >= 0 ? "good" : "needs"}"><b>${escapeHtml(t("analysis.story.mapMargin"))}</b><span>${escapeHtml(signedNumber(margin))}</span></div>
      </div>
    </section>
  `;
}

function renderSkillsStrategyMap(runs) {
  const driverAverage = resultAverage(runs.filter(run => run.skillsType === "driver"), run => run.score);
  const autonAverage = resultAverage(runs.filter(run => run.skillsType === "autonomous"), run => run.score);
  const yellow = skillsYellowEfficiencyValue(runs);
  const centerRate = percentRate(runs.filter(run => run.skills?.centerToggle).length, runs.length);
  const pinAverage = resultAverage(runs, skillsRedBluePins);
  return `
    <section class="analysis-strategy-map">
      <div class="analysis-map-copy">
        <span>${escapeHtml(t("analysis.story.strategyMap"))}</span>
        <h4>${escapeHtml(t("analysis.story.strategyMapSkills"))}</h4>
        <p>${escapeHtml(t("analysis.story.strategyMapSkillsDetail"))}</p>
        <div class="analysis-map-metrics">
          ${renderMapMetric(t("analysis.story.mapDriver"), formatAnalysisNumber(driverAverage), t("analysis.driverAvg"))}
          ${renderMapMetric(t("analysis.story.mapAuton"), formatAnalysisNumber(autonAverage), t("analysis.autonAvg"))}
          ${renderMapMetric(t("analysis.story.mapCenter"), formatRate(centerRate), t("analysis.correlationOption.midfield"))}
          ${renderMapMetric(t("analysis.story.mapYellows"), formatRate(yellow.rate), t("analysis.yellowConversionDetail", { scored: yellow.scored, placed: yellow.placed }))}
          ${renderMapMetric(t("analysis.story.mapPins"), formatAnalysisNumber(pinAverage), t("analysis.correlationOption.redBluePins"))}
        </div>
      </div>
      <div class="analysis-field-map skills" aria-hidden="true">
        <div class="analysis-field-zone top ${driverAverage >= autonAverage ? "good" : "needs"}"><b>${escapeHtml(t("analysis.story.mapDriver"))}</b><span>${escapeHtml(formatAnalysisNumber(driverAverage))}</span></div>
        <div class="analysis-field-zone left ${yellow.rate >= 75 ? "good" : "needs"}"><b>${escapeHtml(t("analysis.story.mapYellows"))}</b><span>${escapeHtml(formatRate(yellow.rate))}</span></div>
        <div class="analysis-field-zone center ${centerRate >= 60 ? "good" : "needs"}"><b>${escapeHtml(t("analysis.story.mapCenter"))}</b><span>${escapeHtml(formatRate(centerRate))}</span></div>
        <div class="analysis-field-zone right ${pinAverage >= 18 ? "good" : "needs"}"><b>${escapeHtml(t("analysis.story.mapPins"))}</b><span>${escapeHtml(formatAnalysisNumber(pinAverage))}</span></div>
        <div class="analysis-field-zone bottom ${autonAverage >= driverAverage ? "good" : "needs"}"><b>${escapeHtml(t("analysis.story.mapAuton"))}</b><span>${escapeHtml(formatAnalysisNumber(autonAverage))}</span></div>
      </div>
    </section>
  `;
}

function renderNextChapter(recommendation, supportingItems = []) {
  return `
    <section class="analysis-next-chapter">
      <div>
        <span>${escapeHtml(t("analysis.story.nextChapter"))}</span>
        <h4>${escapeHtml(recommendation.target)}</h4>
        <p>${escapeHtml(recommendation.proof)}</p>
      </div>
      <div class="analysis-mission-list">
        ${supportingItems.map(item => `
          <div class="analysis-mission">
            <b>${escapeHtml(item.title)}</b>
            <span>${escapeHtml(item.detail)}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderWinFactors(matches) {
  const winOption = flatCorrelationOptions(headCorrelationOptions).find(option => option.key === "win");
  const candidates = flatCorrelationOptions(headCorrelationOptions)
    .filter(option => !["win", "ourScore", "opponentScore"].includes(option.key))
    .map(option => ({ option, ...correlationValue(matches, option, winOption) }))
    .filter(item => item.count >= 6 && Number.isFinite(item.r))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 4);

  if (!candidates.length) {
    return analysisInsightCard(t("analysis.winFactors"), t("analysis.winFactorsEmpty"), t("analysis.learning"));
  }

  return `
    <div class="analysis-insight-card analysis-insight-wide">
      <span>${escapeHtml(t("analysis.winFactors"))}</span>
      <strong>${escapeHtml(t("analysis.topCount", { count: candidates.length }))}</strong>
      <p>${escapeHtml(t("analysis.winFactorsDetail"))}</p>
      <div class="analysis-mini-list">
        ${candidates.map(item => analysisMiniRow(correlationOptionLabel(item.option), item.r.toFixed(2), correlationLabel(item.r))).join("")}
      </div>
    </div>
  `;
}

function missedHeadPoints(match) {
  const alliance = match.teamAlliance;
  const opponent = opponentAlliance(match);
  const scorer = match.scorer || {};
  const centerOwner = midpointOwnerFromRobots(scorer.robots || {});
  let unownedYellow = 0;
  ["top", "right", "bottom", "left"].forEach((quadrant) => {
    const q = scorer.quadrants?.[quadrant] || {};
    if (q.toggle !== alliance) unownedYellow += numericValue(q.yellow) * POINTS.yellowPin;
  });
  const centerYellow = scorer.quadrants?.center?.yellow || 0;
  if (centerOwner !== alliance) unownedYellow += numericValue(centerYellow) * POINTS.yellowPin;

  const auton = scorer.auton || match.auton;
  const autonGap = auton === alliance ? 0 : auton === "tie" ? POINTS.autonTie : POINTS.auton;
  const missingRobots = Math.max(0, 2 - numericValue(ourMidfieldRobots(match))) * POINTS.midfieldRobot;
  const missingCenter = centerOwner === alliance ? 0 : POINTS.midfieldRobot;

  return {
    unownedYellow,
    autonGap,
    missingRobots,
    missingCenter,
    total: unownedYellow + autonGap + missingRobots + missingCenter,
    opponent
  };
}

function renderHeadMissedPoints(matches) {
  const missed = matches.map(missedHeadPoints);
  const total = averageObject(missed, "total");
  return analysisInsightCard(
    t("analysis.missedPoints"),
    t("analysis.missedPointsDetail"),
    t("analysis.avgValue", { value: formatAnalysisNumber(total) })
  );
}

function renderAutonReliability(matches) {
  const wins = matches.filter(autonWon);
  const losses = matches.filter(autonLost);
  const ties = matches.filter(autonTied);
  const margin = group => formatAnalysisNumber(resultAverage(group, match => numericValue(match.ourScore) - numericValue(match.opponentScore)));
  return `
    <div class="analysis-insight-card analysis-insight-wide">
      <span>${escapeHtml(t("analysis.autonReliability"))}</span>
      <strong>${escapeHtml(t("analysis.percentWon", { value: formatAnalysisNumber((wins.length / matches.length) * 100, "%") }))}</strong>
      <p>${escapeHtml(t("analysis.autonReliabilityDetail"))}</p>
      <div class="analysis-mini-list">
        ${analysisMiniRow(t("analysis.wonAuton"), `${wins.length}`, t("analysis.avgMargin", { value: margin(wins) }))}
        ${analysisMiniRow(t("analysis.tiedAuton"), `${ties.length}`, t("analysis.avgMargin", { value: margin(ties) }))}
        ${analysisMiniRow(t("analysis.lostAuton"), `${losses.length}`, t("analysis.avgMargin", { value: margin(losses) }))}
      </div>
    </div>
  `;
}

function renderCenterImpact(matches) {
  const controlled = matches.filter(match => centerControlledByUs(match));
  const notControlled = matches.filter(match => !centerControlledByUs(match));
  const controlledMargin = resultAverage(controlled, match => numericValue(match.ourScore) - numericValue(match.opponentScore));
  const notMargin = resultAverage(notControlled, match => numericValue(match.ourScore) - numericValue(match.opponentScore));
  const swing = Number.isFinite(controlledMargin) && Number.isFinite(notMargin) ? controlledMargin - notMargin : null;
  return analysisInsightCard(
    t("analysis.centerImpact"),
    t("analysis.centerImpactDetail", { withCenter: formatAnalysisNumber(controlledMargin), withoutCenter: formatAnalysisNumber(notMargin) }),
    t("analysis.swing", { value: formatAnalysisNumber(swing) })
  );
}

function renderYellowEfficiency(matches) {
  const placed = matches.reduce((total, match) => total + yellowPins(match), 0);
  const scored = matches.reduce((total, match) => total + numericValue(ownedYellowPins(match)), 0);
  const rate = placed ? (scored / placed) * 100 : null;
  return analysisInsightCard(
    t("analysis.yellowEfficiency"),
    t("analysis.yellowEfficiencyDetail", { scored, placed }),
    formatAnalysisNumber(rate, "%")
  );
}

function renderFloorCeiling(records, getter, title) {
  const values = scoreGetterValues(records, getter);
  return analysisInsightCard(
    title,
    t("analysis.floorCeilingDetail"),
    `${formatAnalysisNumber(percentile(values, .2))} - ${formatAnalysisNumber(percentile(values, .8))}`
  );
}

function previousRangeRecords(records) {
  const bounds = analysisRangeBounds();
  const sorted = records.slice().sort((a, b) => recordTimestamp(a) - recordTimestamp(b));
  if (!bounds) {
    const midpoint = Math.floor(sorted.length / 2);
    return { current: sorted.slice(midpoint), previous: sorted.slice(0, midpoint) };
  }
  const span = bounds.end - bounds.start;
  const previousStart = bounds.start - span;
  const previousEnd = bounds.start;
  return {
    current: sorted.filter(record => {
      const time = recordTimestamp(record);
      return time >= bounds.start && time <= bounds.end;
    }),
    previous: sorted.filter(record => {
      const time = recordTimestamp(record);
      return time >= previousStart && time < previousEnd;
    })
  };
}

function renderProgressCard(records, getter, title) {
  const { current, previous } = previousRangeRecords(records);
  const currentAvg = resultAverage(current, getter);
  const previousAvg = resultAverage(previous, getter);
  const delta = Number.isFinite(currentAvg) && Number.isFinite(previousAvg) ? currentAvg - previousAvg : null;
  const sign = delta > 0 ? "+" : "";
  return analysisInsightCard(
    title,
    previous.length ? t("analysis.previousAverage", { value: formatAnalysisNumber(previousAvg) }) : t("analysis.needEarlierData"),
    Number.isFinite(delta) ? `${sign}${formatAnalysisNumber(delta)}` : "--"
  );
}

function renderBestMatchBlueprint(matches) {
  const best = matches
    .slice()
    .sort((a, b) => numericValue(b.ourScore) - numericValue(a.ourScore))
    .slice(0, 3);
  if (!best.length) return "";
  const avgAlliancePins = resultAverage(best, ourAlliancePins);
  const avgYellows = resultAverage(best, match => ownedYellowPins(match));
  const centerCount = best.filter(centerControlledByUs).length;
  const autonCount = best.filter(autonWon).length;
  return analysisInsightCard(
    t("analysis.bestBlueprint"),
    t("analysis.bestBlueprintDetail", {
      pins: formatAnalysisNumber(avgAlliancePins),
      yellows: formatAnalysisNumber(avgYellows),
      center: centerCount,
      auton: autonCount
    }),
    t("analysis.avgValue", { value: formatAnalysisNumber(resultAverage(best, match => match.ourScore)) })
  );
}

function renderHeadInsights(matches, allMatches) {
  if (!matches.length) return "";
  return [
    renderWinFactors(matches),
    renderHeadMissedPoints(matches),
    renderAutonReliability(matches),
    renderCenterImpact(matches),
    renderYellowEfficiency(matches),
    renderFloorCeiling(matches, match => match.ourScore, t("analysis.badGoodRange")),
    renderProgressCard(allMatches, match => match.ourScore, t("analysis.weeklyProgress")),
    renderBestMatchBlueprint(matches)
  ].join("");
}

function renderSkillsMissedPoints(runs) {
  const missed = runs.reduce((total, run) => total + skillsMissedYellowPins(run), 0);
  const placed = runs.reduce((total, run) => total + skillsYellowPins(run), 0);
  const rate = placed ? ((placed - missed) / placed) * 100 : null;
  return analysisInsightCard(
    t("analysis.yellowConversion"),
    t("analysis.yellowConversionDetail", { scored: placed - missed, placed }),
    formatAnalysisNumber(rate, "%")
  );
}

function renderSkillsRouteProgress(runs) {
  const sorted = runs.slice().sort((a, b) => recordTimestamp(a) - recordTimestamp(b));
  const driver = sorted.filter(run => run.skillsType === "driver");
  const auton = sorted.filter(run => run.skillsType === "autonomous");
  const splitDelta = group => {
    if (group.length < 4) return null;
    const midpoint = Math.floor(group.length / 2);
    return resultAverage(group.slice(midpoint), run => run.score) - resultAverage(group.slice(0, midpoint), run => run.score);
  };
  const driverDelta = splitDelta(driver);
  const autonDelta = splitDelta(auton);
  return `
    <div class="analysis-insight-card analysis-insight-wide">
      <span>${escapeHtml(t("analysis.skillsRouteProgress"))}</span>
      <strong>${escapeHtml(countText("analysis.runs", runs.length))}</strong>
      <p>${escapeHtml(t("analysis.skillsRouteProgressDetail"))}</p>
      <div class="analysis-mini-list">
        ${analysisMiniRow(t("analysis.driverTrend"), Number.isFinite(driverDelta) ? `${driverDelta > 0 ? "+" : ""}${formatAnalysisNumber(driverDelta)}` : "--", countText("analysis.runs", driver.length))}
        ${analysisMiniRow(t("analysis.autonTrend"), Number.isFinite(autonDelta) ? `${autonDelta > 0 ? "+" : ""}${formatAnalysisNumber(autonDelta)}` : "--", countText("analysis.runs", auton.length))}
      </div>
    </div>
  `;
}

function renderSkillsInsights(runs, allRuns) {
  if (!runs.length) return "";
  return [
    renderSkillsMissedPoints(runs),
    renderFloorCeiling(runs, run => run.score, t("analysis.badGoodRange")),
    renderProgressCard(allRuns, run => run.score, t("analysis.weeklyProgress")),
    renderSkillsRouteProgress(runs)
  ].join("");
}

function headRecommendation(matches) {
  const stats = analysisScoreStats(matches, match => match.ourScore);
  const wins = matches.filter(match => match.result === "win").length;
  const winRate = matches.length ? (wins / matches.length) * 100 : null;
  const yellow = yellowEfficiencyValue(matches);
  const autonWinRate = matches.length ? (matches.filter(autonWon).length / matches.length) * 100 : null;
  const centerRate = matches.length ? (matches.filter(centerControlledByUs).length / matches.length) * 100 : null;
  const missedAverage = resultAverage(matches, match => missedHeadPoints(match).total);
  const recentDelta = Number.isFinite(stats.recentMean) && Number.isFinite(stats.mean) ? stats.recentMean - stats.mean : null;
  const pinAverage = resultAverage(matches, ourAlliancePins);
  const marginAverage = resultAverage(matches, scoreMargin);
  const floor = percentile(scoreGetterValues(matches, match => match.ourScore), .2);
  const floorGap = Number.isFinite(stats.mean) && Number.isFinite(floor) ? stats.mean - floor : null;

  if (Number.isFinite(autonWinRate) && autonWinRate < 45) {
    return {
      key: "auton",
      title: t("analysis.story.head.auton.title"),
      why: t("analysis.story.head.auton.why"),
      proof: t("analysis.story.head.auton.proof", { rate: formatRate(autonWinRate), margin: formatAnalysisNumber(marginAverage) }),
      target: t("analysis.story.head.auton.target")
    };
  }
  if (Number.isFinite(centerRate) && centerRate < 55) {
    return {
      key: "center",
      title: t("analysis.story.head.center.title"),
      why: t("analysis.story.head.center.why"),
      proof: t("analysis.story.head.center.proof", { rate: formatRate(centerRate), missed: formatAnalysisNumber(missedAverage) }),
      target: t("analysis.story.head.center.target")
    };
  }
  if (Number.isFinite(yellow.rate) && yellow.rate < 78) {
    return {
      key: "yellow",
      title: t("analysis.story.head.yellow.title"),
      why: t("analysis.story.head.yellow.why"),
      proof: t("analysis.story.head.yellow.proof", { scored: yellow.scored, placed: yellow.placed, rate: formatRate(yellow.rate) }),
      target: t("analysis.story.head.yellow.target")
    };
  }
  if (Number.isFinite(floorGap) && floorGap > 24) {
    return {
      key: "floor",
      title: t("analysis.story.head.floor.title"),
      why: t("analysis.story.head.floor.why"),
      proof: t("analysis.story.head.floor.proof", { average: formatAnalysisNumber(stats.mean), floor: formatAnalysisNumber(floor) }),
      target: t("analysis.story.head.floor.target")
    };
  }
  if (Number.isFinite(winRate) && winRate < 55) {
    return {
      key: "margin",
      title: t("analysis.story.head.margin.title"),
      why: t("analysis.story.head.margin.why"),
      proof: t("analysis.story.head.margin.proof", { rate: formatRate(winRate), margin: formatAnalysisNumber(marginAverage) }),
      target: t("analysis.story.head.margin.target")
    };
  }
  return {
    key: "ceiling",
    title: t("analysis.story.head.ceiling.title"),
    why: t("analysis.story.head.ceiling.why"),
    proof: t("analysis.story.head.ceiling.proof", { average: formatAnalysisNumber(stats.mean), pins: formatAnalysisNumber(pinAverage) }),
    target: t("analysis.story.head.ceiling.target")
  };
}

function headProofCards(matches, allMatches) {
  const stats = analysisScoreStats(matches, match => match.ourScore);
  const recentDelta = Number.isFinite(stats.recentMean) && Number.isFinite(stats.mean) ? stats.recentMean - stats.mean : null;
  const missedAverage = resultAverage(matches, match => missedHeadPoints(match).total);
  const autonRate = percentRate(matches.filter(autonWon).length, matches.length);
  const autonWins = matches.filter(autonWon).length;
  const autonLosses = matches.filter(autonLost).length;
  const autonTies = matches.filter(autonTied).length;
  const centerRate = percentRate(matches.filter(centerControlledByUs).length, matches.length);
  const yellow = yellowEfficiencyValue(matches);
  const margin = resultAverage(matches, scoreMargin);
  return [
    {
      label: t("analysis.story.openingPhase"),
      value: formatRate(autonRate),
      detail: t("analysis.story.openingHeadDetail", {
        autonWins,
        autonLosses,
        autonTies,
        points: formatAnalysisNumber(resultAverage(matches, autonPoints))
      })
    },
    {
      label: t("analysis.story.controlPhase"),
      value: formatRate(centerRate),
      detail: t("analysis.story.controlHeadDetail", {
        center: formatRate(centerRate),
        yellows: formatRate(yellow.rate),
        pins: formatAnalysisNumber(resultAverage(matches, ourAlliancePins))
      })
    },
    {
      label: t("analysis.story.finishPhase"),
      value: signedNumber(recentDelta),
      detail: t("analysis.story.finishHeadDetail", {
        margin: signedNumber(margin),
        missed: formatAnalysisNumber(missedAverage)
      })
    }
  ];
}

function renderHeadBreakdown(matches, allMatches) {
  const wins = matches.filter(match => match.result === "win");
  const losses = matches.filter(match => match.result === "loss");
  const recommendation = headRecommendation(matches);
  const comparisonItems = [
    { label: t("analysis.averageScore"), getter: match => match.ourScore },
    { label: t("analysis.autonReliability"), getter: autonWon, percent: true },
    { label: t("analysis.centerImpact"), getter: centerControlledByUs, percent: true },
    { label: t("analysis.yellowEfficiency"), getter: match => yellowPins(match) ? numericValue(ownedYellowPins(match)) / yellowPins(match) : null, percent: true },
    { label: t("analysis.correlationOption.margin"), getter: scoreMargin }
  ].map(item => {
    const winValue = resultAverage(wins, item.getter);
    const lossValue = resultAverage(losses, item.getter);
    const difference = Number.isFinite(winValue) && Number.isFinite(lossValue) ? Math.abs(winValue - lossValue) : -1;
    return { ...item, winValue, lossValue, difference };
  })
    .sort((a, b) => b.difference - a.difference)
    .slice(0, 3);
  const compare = item => {
    const display = value => item.percent ? formatRate(Number.isFinite(value) ? value * 100 : value) : formatAnalysisNumber(value);
    return analysisMiniRow(item.label, `${display(item.winValue)} / ${display(item.lossValue)}`, t("analysis.story.winsLosses"));
  };
  return `
    ${renderHeadStrategyMap(matches)}
    <section class="analysis-turning-point">
      <div>
        <span>${escapeHtml(t("analysis.story.turningPoint"))}</span>
        <h4>${escapeHtml(t("analysis.story.whatChanges"))}</h4>
        <p>${escapeHtml(t("analysis.story.winLossDetail"))}</p>
      </div>
      <div class="analysis-insight-card analysis-insight-wide">
        <div class="analysis-mini-list">
          ${comparisonItems.map(compare).join("")}
        </div>
      </div>
    </section>
    ${renderNextChapter(recommendation, [
      { title: t("analysis.story.missionAuton"), detail: t("analysis.story.missionAutonDetail", { value: formatRate(percentRate(matches.filter(autonWon).length, matches.length)) }) },
      { title: t("analysis.story.missionCenter"), detail: t("analysis.story.missionCenterDetail", { value: formatRate(percentRate(matches.filter(centerControlledByUs).length, matches.length)) }) },
      { title: t("analysis.story.missionReview"), detail: t("analysis.story.missionReviewDetail") }
    ])}
  `;
}

function skillsRecommendation(runs) {
  const stats = analysisScoreStats(runs, run => run.score);
  const driverScores = scoreGetterValues(runs.filter(run => run.skillsType === "driver"), run => run.score);
  const autonScores = scoreGetterValues(runs.filter(run => run.skillsType === "autonomous"), run => run.score);
  const bestDriver = driverScores.length ? Math.max(...driverScores) : null;
  const bestAuton = autonScores.length ? Math.max(...autonScores) : null;
  const driverAverage = resultAverage(runs.filter(run => run.skillsType === "driver"), run => run.score);
  const autonAverage = resultAverage(runs.filter(run => run.skillsType === "autonomous"), run => run.score);
  const yellow = skillsYellowEfficiencyValue(runs);
  const centerRate = percentRate(runs.filter(run => run.skills?.centerToggle).length, runs.length);
  const combined = (bestDriver || 0) + (bestAuton || 0);
  const recentDelta = Number.isFinite(stats.recentMean) && Number.isFinite(stats.mean) ? stats.recentMean - stats.mean : null;
  if (!driverScores.length || !autonScores.length) {
    return {
      key: "balance",
      title: t("analysis.story.skills.balance.title"),
      why: t("analysis.story.skills.balance.why"),
      proof: t("analysis.story.skills.balance.proof", { driver: driverScores.length, auton: autonScores.length }),
      target: t("analysis.story.skills.balance.target")
    };
  }
  if (Number.isFinite(driverAverage) && driverAverage + 8 < autonAverage) {
    return {
      key: "driver",
      title: t("analysis.story.skills.driver.title"),
      why: t("analysis.story.skills.driver.why"),
      proof: t("analysis.story.skills.driver.proof", { driver: formatAnalysisNumber(driverAverage), auton: formatAnalysisNumber(autonAverage) }),
      target: t("analysis.story.skills.driver.target")
    };
  }
  if (Number.isFinite(autonAverage) && autonAverage + 8 < driverAverage) {
    return {
      key: "auton",
      title: t("analysis.story.skills.auton.title"),
      why: t("analysis.story.skills.auton.why"),
      proof: t("analysis.story.skills.auton.proof", { driver: formatAnalysisNumber(driverAverage), auton: formatAnalysisNumber(autonAverage) }),
      target: t("analysis.story.skills.auton.target")
    };
  }
  if (Number.isFinite(yellow.rate) && yellow.rate < 78) {
    return {
      key: "yellow",
      title: t("analysis.story.skills.yellow.title"),
      why: t("analysis.story.skills.yellow.why"),
      proof: t("analysis.story.skills.yellow.proof", { scored: yellow.scored, placed: yellow.placed, rate: formatRate(yellow.rate) }),
      target: t("analysis.story.skills.yellow.target")
    };
  }
  if (Number.isFinite(centerRate) && centerRate < 60) {
    return {
      key: "center",
      title: t("analysis.story.skills.center.title"),
      why: t("analysis.story.skills.center.why"),
      proof: t("analysis.story.skills.center.proof", { rate: formatRate(centerRate) }),
      target: t("analysis.story.skills.center.target")
    };
  }
  return {
    key: "ceiling",
    title: t("analysis.story.skills.ceiling.title"),
    why: t("analysis.story.skills.ceiling.why"),
    proof: t("analysis.story.skills.ceiling.proof", { combined: formatAnalysisNumber(combined), recent: signedNumber(recentDelta) }),
    target: t("analysis.story.skills.ceiling.target")
  };
}

function skillsProofCards(runs) {
  const stats = analysisScoreStats(runs, run => run.score);
  const driverAverage = resultAverage(runs.filter(run => run.skillsType === "driver"), run => run.score);
  const autonAverage = resultAverage(runs.filter(run => run.skillsType === "autonomous"), run => run.score);
  const yellow = skillsYellowEfficiencyValue(runs);
  const recentDelta = Number.isFinite(stats.recentMean) && Number.isFinite(stats.mean) ? stats.recentMean - stats.mean : null;
  const centerRate = percentRate(runs.filter(run => run.skills?.centerToggle).length, runs.length);
  return [
    {
      label: t("analysis.story.routeStart"),
      value: t("analysis.story.driverAutonValue", { driver: formatAnalysisNumber(driverAverage), auton: formatAnalysisNumber(autonAverage) }),
      detail: t("analysis.story.routeStartDetail", { driver: formatAnalysisNumber(driverAverage), auton: formatAnalysisNumber(autonAverage) })
    },
    {
      label: t("analysis.story.routeControl"),
      value: formatRate(centerRate),
      detail: t("analysis.story.routeControlDetail", { center: formatRate(centerRate), yellows: formatRate(yellow.rate) })
    },
    {
      label: t("analysis.story.routeCeiling"),
      value: signedNumber(recentDelta),
      detail: recentFormDetail(stats) || t("analysis.story.needRecent")
    }
  ];
}

function renderSkillsBreakdown(runs, allRuns) {
  const recommendation = skillsRecommendation(runs);
  return `
    ${renderSkillsStrategyMap(runs)}
    ${renderNextChapter(recommendation, [
      { title: t("analysis.story.missionDriver"), detail: t("analysis.story.missionDriverDetail", { value: formatAnalysisNumber(resultAverage(runs.filter(run => run.skillsType === "driver"), run => run.score)) }) },
      { title: t("analysis.story.missionAuton"), detail: t("analysis.story.missionSkillsAutonDetail", { value: formatAnalysisNumber(resultAverage(runs.filter(run => run.skillsType === "autonomous"), run => run.score)) }) },
      { title: t("analysis.story.missionReview"), detail: t("analysis.story.missionReviewDetail") }
    ])}
  `;
}

function sparklineSvg(records, scoreGetter) {
  const entries = records
    .slice()
    .sort((a, b) => recordTimestamp(a) - recordTimestamp(b))
    .map(record => ({ record, score: numericValue(scoreGetter(record)) }))
    .filter(item => Number.isFinite(item.score));
  const points = entries.map(item => item.score);

  if (points.length < 2) {
    return `<p class="analysis-empty-mini">${escapeHtml(t("analysis.needTrend"))}</p>`;
  }

  const width = 760;
  const height = 210;
  const padX = 34;
  const padY = 26;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 1);
  const averageLine = average(points);
  const recentStart = Math.max(0, points.length - 5);
  const step = points.length === 1 ? 0 : (width - padX * 2) / (points.length - 1);
  const coordinatePairs = points.map((score, index) => {
    const x = padX + index * step;
    const y = height - padY - ((score - min) / range) * (height - padY * 2);
    return { x, y, text: `${x.toFixed(1)},${y.toFixed(1)}` };
  });
  const coordinates = coordinatePairs.map(point => point.text).join(" ");
  const recentCoordinates = coordinatePairs.slice(recentStart).map(point => point.text).join(" ");
  const averageY = height - padY - ((averageLine - min) / range) * (height - padY * 2);

  const dots = points.map((score, index) => {
    const x = padX + index * step;
    const y = height - padY - ((score - min) / range) * (height - padY * 2);
    const record = entries[index].record;
    const key = record.mode === "skills" ? "run" : "match";
    const date = formatMatchDate(entries[index].record);
    const resultClass = record.mode === "skills" ? (record.skillsType === "autonomous" ? "autonomous" : "driver") : (record.result || "saved");
    const recentClass = index >= recentStart ? " recent" : "";
    return `<circle class="analysis-story-dot ${escapeHtml(resultClass)}${recentClass}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${index >= recentStart ? "5.2" : "4.1"}"><title>${escapeHtml(t(`analysis.pointTitle.${key}`, { index: index + 1, score: formatAnalysisNumber(score), date }))}</title></circle>`;
  }).join("");

  return `
    <div class="analysis-story-chart">
      <div class="analysis-chart-labels">
        <span>${escapeHtml(t("analysis.low", { value: formatAnalysisNumber(min) }))}</span>
        <span>${escapeHtml(t("analysis.story.averageLine", { value: formatAnalysisNumber(averageLine) }))}</span>
        <span>${escapeHtml(t("analysis.high", { value: formatAnalysisNumber(max) }))}</span>
      </div>
      <svg class="analysis-sparkline analysis-story-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(t("analysis.scoreTrend"))}">
        <line class="analysis-grid-line" x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" />
        <line class="analysis-average-line" x1="${padX}" y1="${averageY.toFixed(1)}" x2="${width - padX}" y2="${averageY.toFixed(1)}" />
        <polyline class="analysis-story-line" points="${coordinates}" />
        ${recentCoordinates.includes(" ") ? `<polyline class="analysis-recent-line" points="${recentCoordinates}" />` : ""}
        ${dots}
      </svg>
      <div class="analysis-chart-labels">
        <span>${escapeHtml(t("analysis.oldest", { value: formatAnalysisNumber(points[0]) }))}</span>
        <span>${escapeHtml(t("analysis.story.recentFive"))}</span>
        <span>${escapeHtml(t("analysis.newest", { value: formatAnalysisNumber(points[points.length - 1]) }))}</span>
      </div>
    </div>
  `;
}

function timelineRead(records, scoreGetter) {
  const scores = records
    .slice()
    .sort((a, b) => recordTimestamp(a) - recordTimestamp(b))
    .map(record => numericValue(scoreGetter(record)))
    .filter(value => Number.isFinite(value));
  if (scores.length < 4) {
    return {
      title: t("analysis.story.timelineFlat"),
      detail: t("analysis.story.needRecent"),
      delta: "--",
      tone: "flat"
    };
  }
  const windowSize = Math.min(5, Math.max(2, Math.floor(scores.length / 3)));
  const opening = average(scores.slice(0, windowSize));
  const recent = average(scores.slice(-windowSize));
  const delta = recent - opening;
  const absDelta = Math.abs(delta);
  const tone = delta > 6 ? "up" : delta < -6 ? "down" : "flat";
  const detailKey = tone === "up"
    ? "analysis.story.timelineUpDetail"
    : tone === "down"
      ? "analysis.story.timelineDownDetail"
      : "analysis.story.timelineFlatDetail";
  return {
    title: t(`analysis.story.timeline${tone === "up" ? "Up" : tone === "down" ? "Down" : "Flat"}`),
    detail: t(detailKey, { delta: signedNumber(delta) }),
    delta: signedNumber(delta),
    tone
  };
}

function renderTrend(records, scoreGetter) {
  const isSkills = records.some(record => record.mode === "skills");
  const read = timelineRead(records, scoreGetter);
  return `
    <section class="analysis-timeline-stage">
      <div class="analysis-film-room-read ${escapeHtml(read.tone)}">
        <div>
          <span>${escapeHtml(t("analysis.story.filmRoom"))}</span>
          <h4>${escapeHtml(read.title)}</h4>
          <p>${escapeHtml(read.detail)}</p>
        </div>
        <strong>
          <small>${escapeHtml(t("analysis.story.recentSwing"))}</small>
          ${escapeHtml(read.delta)}
        </strong>
      </div>
      <div class="analysis-trend-head">
        <span>${escapeHtml(t("analysis.story.progressStory"))}</span>
        <small>${escapeHtml(t(isSkills ? "analysis.trendDetail.run" : "analysis.trendDetail.match"))}</small>
      </div>
      ${sparklineSvg(records, scoreGetter)}
      <div class="analysis-chart-legend" aria-hidden="true">
        ${isSkills
          ? `<span class="driver">${escapeHtml(t("skills.driver"))}</span><span class="autonomous">${escapeHtml(t("skills.autonomous"))}</span>`
          : `<span class="win">${escapeHtml(t("history.result.win"))}</span><span class="loss">${escapeHtml(t("history.result.loss"))}</span><span class="tie">${escapeHtml(t("history.result.tie"))}</span>`}
        <span class="recent">${escapeHtml(t("analysis.story.recentFive"))}</span>
      </div>
    </section>
  `;
}

function clampUnit(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function replayConfidence(count) {
  if (count >= 12) return { label: t("analysis.replay.confidenceStrong"), tone: "strong" };
  if (count >= 5) return { label: t("analysis.replay.confidenceDeveloping"), tone: "developing" };
  return { label: t("analysis.replay.confidenceEarly"), tone: "early" };
}

function replayRangeLabel() {
  if (analysisRange === "today") return t("range.today");
  if (analysisRange === "7") return t("range.7");
  if (analysisRange === "30") return t("range.30");
  if (analysisRange === "custom") {
    const start = $("[data-analysis-start]")?.value || t("range.start");
    const end = $("[data-analysis-end]")?.value || t("range.end");
    return `${start} - ${end}`;
  }
  return t("range.all");
}

function recordWindowAverage(records, getter, fromStart) {
  const ordered = records.slice().sort((a, b) => recordTimestamp(a) - recordTimestamp(b));
  const size = Math.min(5, Math.max(1, Math.ceil(ordered.length / 4)));
  return resultAverage(fromStart ? ordered.slice(0, size) : ordered.slice(-size), getter);
}

function replayTurningMoment(records, getter) {
  const ordered = records.slice().sort((a, b) => recordTimestamp(a) - recordTimestamp(b));
  if (ordered.length < 5) {
    const record = ordered[ordered.length - 1];
    return { index: Math.max(ordered.length - 1, 0), record, delta: 0 };
  }
  let strongest = { index: 2, record: ordered[2], delta: 0 };
  for (let index = 2; index <= ordered.length - 3; index += 1) {
    const before = resultAverage(ordered.slice(Math.max(0, index - 3), index), getter);
    const after = resultAverage(ordered.slice(index, Math.min(ordered.length, index + 3)), getter);
    const delta = Number.isFinite(before) && Number.isFinite(after) ? after - before : 0;
    if (Math.abs(delta) > Math.abs(strongest.delta)) strongest = { index, record: ordered[index], delta };
  }
  return strongest;
}

function replayTrajectory(records, getter) {
  const classified = classifySavedTrajectory(records, getter);
  const { opening, current, delta, tone, shape } = classified;
  const title = trajectoryShapeLabel(shape);
  const summaryKey = shape === "recovery"
    ? "analysis.replay.shapeRecovery"
    : shape === "decline"
      ? "analysis.replay.shapeDecline"
      : shape === "steady"
        ? "analysis.replay.shapeSteady"
        : "analysis.replay.shapeImproving";
  const summary = t(summaryKey);
  return { opening, current, delta, tone, shape, title, summary, turning: replayTurningMoment(records, getter) };
}

function replayRollingTrajectory(records, getter, windowSize) {
  const ordered = records.slice().sort((a, b) => recordTimestamp(a) - recordTimestamp(b));
  if (ordered.length < windowSize) return replayTrajectory(records, getter);
  const values = ordered.map(record => numericValue(getter(record)));
  const averages = rollingAverageSeries(values, windowSize).slice(windowSize - 1);
  let turningIndex = 0;
  let turningDelta = 0;
  for (let index = 1; index < averages.length; index += 1) {
    const change = averages[index] - averages[index - 1];
    if (Math.abs(change) > Math.abs(turningDelta)) {
      turningIndex = index;
      turningDelta = change;
    }
  }
  const base = replayTrajectory(records, getter);
  return {
    ...base,
    opening: averages[0],
    current: averages.at(-1),
    delta: averages.at(-1) - averages[0],
    turning: {
      index: turningIndex + windowSize - 1,
      record: ordered[turningIndex + windowSize - 1],
      delta: turningDelta
    }
  };
}

function headYellowRate(match) {
  const placed = yellowPins(match);
  return placed ? numericValue(ownedYellowPins(match)) / placed : null;
}

function skillsYellowRate(run) {
  const placed = skillsYellowPins(run);
  return placed ? skillsScoredYellowPins(run) / placed : null;
}

function scoreGapForGroups(positive, negative, getter) {
  if (positive.length < 2 || negative.length < 2) return 0;
  return resultAverage(positive, getter) - resultAverage(negative, getter);
}

function coachRecommendationView(result, mode) {
  const fallbackKey = mode === "head" ? "headNeedData" : "skillsBalance";
  const key = result?.ready
    ? result.key
    : result?.reason === "noSignal"
      ? mode === "head" ? "headNoSignal" : "skillsNoSignal"
      : fallbackKey;
  const guide = coachGuides[currentLanguage]?.[key] || coachGuides.en[key] || coachGuides.en[fallbackKey];
  const evidence = result?.evidence || {};
  const params = {
    ...evidence,
    count: result?.count ?? 0,
    needed: result?.needed ?? 0,
    rate: Number.isFinite(evidence.rate) ? formatRate(evidence.rate * 100) : "--",
    swing: formatAnalysisNumber(evidence.marginSwing),
    marginSwing: formatAnalysisNumber(evidence.marginSwing),
    missedPoints: formatAnalysisNumber(evidence.missedPoints),
    winningPins: formatAnalysisNumber(evidence.winningPins),
    losingPins: formatAnalysisNumber(evidence.losingPins),
    pinGap: formatAnalysisNumber(evidence.pinGap),
    best: formatAnalysisNumber(evidence.best),
    median: formatAnalysisNumber(evidence.median),
    gap: formatAnalysisNumber(evidence.gap),
    second: formatAnalysisNumber(evidence.second),
    target: formatAnalysisNumber(evidence.target),
    route: evidence.route ? t(`skills.${evidence.route}`) : "",
    zone: evidence.zone ? t(`quadrant.${evidence.zone}`) : "",
    color: evidence.color ? t(`color.${evidence.color}`).toLowerCase() : ""
  };
  const interpolate = text => String(text || "").replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
  const focusKeys = {
    headAutonCode: "auton",
    headHoldAuton: "auton",
    headMidfield: "center",
    headYellow: "yellow",
    headToggleZone: "yellow",
    headEndgame: "endgame",
    headPins: "pins",
    headNeedData: "review",
    headNoSignal: "review",
    skillsBalance: "balance",
    skillsDriverRepeat: "driver",
    skillsAutonRepeat: "auton",
    skillsRouteGain: evidence.route || "driver",
    skillsYellow: "yellow",
    skillsCenter: "center",
    skillsPlacement: "placement",
    skillsEventSet: "eventSet",
    skillsCeiling: "ceiling"
  };
  return {
    key: focusKeys[key] || "review",
    recommendationKey: key,
    ready: Boolean(result?.ready),
    confidence: result?.confidence || "early",
    comparison: result?.comparison || null,
    title: interpolate(guide.title),
    why: interpolate(guide.meaning),
    proof: interpolate(guide.proof),
    target: interpolate(guide.target),
    steps: guide.steps.map(interpolate)
  };
}

function rankedHeadRecommendation(matches) {
  const rows = matches.map(match => ({
    score: numericValue(match.ourScore),
    margin: scoreMargin(match),
    result: match.result,
    autonOutcome: autonWon(match) ? "win" : autonTied(match) ? "tie" : "loss",
    centerControlled: Boolean(centerControlledByUs(match)),
    ourMidfieldRobots: numericValue(ourMidfieldRobots(match)),
    opponentMidfieldRobots: numericValue(opponentMidfieldRobots(match)),
    yellowPlaced: yellowPins(match),
    yellowOwned: numericValue(ownedYellowPins(match)),
    opponentYellowOwned: numericValue(opponentOwnedYellowPins(match)),
    alliancePins: numericValue(ourAlliancePins(match)),
    opponentPins: numericValue(opponentAlliancePins(match)),
    zoneMissedYellow: Object.fromEntries(["top", "right", "bottom", "left"].map(zone => [
      zone,
      Math.max(0, yellowPinsInQuadrant(match, zone) - ownedYellowPinsInQuadrant(match, zone))
    ]))
  }));
  const result = globalThis.VexAnalysisCoach?.selectHeadRecommendation(rows);
  return coachRecommendationView(result, "head");
}

function rankedSkillsRecommendation(runs) {
  const misplaced = (run, color, zone) => {
    const scoresHere = color === "red"
      ? ["left", "bottom", "center"].includes(zone)
      : ["top", "right", "center"].includes(zone);
    return scoresHere ? 0 : numericValue(run.skills?.quadrants?.[zone]?.[color]);
  };
  const rows = runs.map(run => ({
    type: run.skillsType,
    score: numericValue(run.score),
    yellowPlaced: skillsYellowPins(run),
    yellowScored: skillsScoredYellowPins(run),
    centerComplete: Boolean(run.skills?.centerToggle),
    centerPotentialPoints: POINTS.midfieldRobot + numericValue(run.skills?.quadrants?.center?.yellow) * POINTS.yellowPin,
    misplacedPins: Object.fromEntries(["red", "blue"].map(color => [
      color,
      Object.fromEntries(skillsQuadrants.map(zone => [zone, misplaced(run, color, zone)]))
    ]))
  }));
  const result = globalThis.VexAnalysisCoach?.selectSkillsRecommendation(rows);
  return coachRecommendationView(result, "skills");
}

function sentenceCase(value) {
  const text = String(value || "");
  return text ? `${text.charAt(0).toLocaleUpperCase(languageLocale())}${text.slice(1)}` : text;
}

function autonResultLabel(record) {
  if (autonWon(record)) return t("analysis.wonAuton");
  if (autonTied(record)) return t("analysis.tiedAuton");
  return t("analysis.lostAuton");
}

function replayPointLabel(mode, record, index) {
  const date = formatMatchDate(record);
  if (mode === "skills") {
    return t("analysis.pointDetail.run", {
      type: skillsTypeLabel(record.skillsType),
      index: index + 1,
      date,
      score: formatAnalysisNumber(record.score)
    });
  }
  return t("analysis.pointDetail.match", {
    index: index + 1,
    date,
    result: sentenceCase(matchResultLabel(record)),
    ourScore: formatAnalysisNumber(record.ourScore),
    opponentScore: formatAnalysisNumber(record.opponentScore),
    auton: autonResultLabel(record)
  });
}

function replayXAxisIndexes(count) {
  if (count <= 6) return Array.from({ length: count }, (_, index) => index);
  const candidates = [2, 3, 5, 10, 15, 20, 25, 50, 100, 200];
  let best = [];
  let bestDistance = Infinity;
  candidates.forEach(step => {
    const labels = new Set([1, count]);
    for (let value = step; value < count; value += step) labels.add(value);
    const indexes = [...labels].sort((a, b) => a - b).map(value => value - 1);
    const distance = Math.abs(indexes.length - 6);
    if (distance < bestDistance) {
      best = indexes;
      bestDistance = distance;
    }
  });
  return best;
}

function rollingAverageSeries(values, windowSize = 5) {
  return values.map((_, index) => average(values.slice(Math.max(0, index - windowSize + 1), index + 1)));
}

function signedAnalysisNumber(value) {
  const formatted = formatAnalysisNumber(value);
  return Number(value) > 0 ? `+${formatted}` : formatted;
}

function renderReplayTimeline(mode, records, getter, trajectory) {
  const ordered = records.slice().sort((a, b) => recordTimestamp(a) - recordTimestamp(b));
  const points = ordered.map(record => numericValue(getter(record)));
  const isMargin = mode === "head" && headTrajectoryMetric === "margin";
  const rolling = rollingAverageSeries(points, isMargin ? 10 : 5);
  const width = 1000;
  const height = 420;
  const padLeft = 96;
  const padRight = 30;
  const padTop = 26;
  const padBottom = 104;
  const plotRight = width - padRight;
  const plotBottom = height - padBottom;
  const domainValues = points;
  const rawMin = Math.min(...domainValues);
  const rawMax = Math.max(...domainValues);
  let min = Math.floor(rawMin / 25) * 25;
  let max = Math.ceil(rawMax / 25) * 25;
  if (!isMargin) min = Math.max(0, min);
  if (isMargin) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (min === rawMin && (!isMargin || min !== 0) && min > 0) min -= 25;
  if (max === rawMax) max += 25;
  if (min === max) {
    min -= isMargin ? 25 : 0;
    max += 25;
  }
  const range = Math.max(max - min, 25);
  const slotCount = Math.max(1, points.length);
  const step = slotCount === 1 ? 0 : (plotRight - padLeft) / (slotCount - 1);
  const yFor = score => plotBottom - ((score - min) / range) * (plotBottom - padTop);
  const coordinates = points.map((score, index) => ({ x: padLeft + index * step, y: yFor(score), score }));
  const pathPoints = coordinates.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const rollingCoordinates = rolling
    .map((score, index) => ({ x: padLeft + index * step, y: yFor(score), score }))
    .slice(isMargin ? 9 : 0);
  const rollingPathPoints = rollingCoordinates.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const marginGrowth = isMargin && rollingCoordinates.length
    ? rollingCoordinates.at(-1).score - rollingCoordinates[0].score
    : null;
  const recentStart = Math.max(0, points.length - 5);
  const recentCount = points.length - recentStart;
  const bracketStart = points.length === 1 ? Math.max(padLeft, coordinates[0].x - 18) : coordinates[recentStart].x;
  const bracketEnd = points.length === 1 ? Math.min(plotRight, coordinates[0].x + 18) : coordinates.at(-1).x;
  const bracketY = plotBottom + 38;
  const yTicks = [];
  for (let value = min; value <= max; value += 25) yTicks.push(value);
  const grid = yTicks.map(value => {
    const y = yFor(value);
    const guideClass = isMargin && value === 0 ? "replay-score-guide replay-zero-guide" : "replay-score-guide";
    return `<line class="${guideClass}" x1="${padLeft}" y1="${y.toFixed(1)}" x2="${plotRight}" y2="${y.toFixed(1)}"></line>
      <line class="replay-axis-tick" x1="${padLeft - 6}" y1="${y.toFixed(1)}" x2="${padLeft}" y2="${y.toFixed(1)}"></line>
      <text class="replay-axis-label" x="${padLeft - 12}" y="${(y + 5).toFixed(1)}" text-anchor="end">${value}</text>`;
  }).join("");
  const xTicks = replayXAxisIndexes(points.length).map(index => {
    const x = coordinates[index].x;
    return `<line class="replay-axis-tick" x1="${x.toFixed(1)}" y1="${plotBottom}" x2="${x.toFixed(1)}" y2="${plotBottom + 6}"></line>
      <text class="replay-axis-label" x="${x.toFixed(1)}" y="${plotBottom + 25}" text-anchor="middle">${index + 1}</text>`;
  }).join("");
  const axisXKey = mode === "skills" ? "analysis.replay.axisSkillsX" : "analysis.replay.axisHeadX";
  const axisYKey = mode === "skills"
    ? "analysis.replay.axisSkillsY"
    : isMargin ? "analysis.replay.axisHeadMarginY" : "analysis.replay.axisHeadY";
  const axisCenterY = (padTop + plotBottom) / 2;
  const dots = coordinates.map((point, index) => {
    const record = ordered[index];
    const resultClass = mode === "skills" ? (record.skillsType === "autonomous" ? "autonomous" : "driver") : (record.result || "saved");
    const label = replayPointLabel(mode, record, index);
    return `
      <g class="replay-chart-point ${escapeHtml(resultClass)}" transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})" tabindex="0" role="button" data-replay-point="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
        <circle class="replay-point-hit" r="17"></circle>
        <circle class="replay-point-ring" r="7"></circle>
        <circle class="replay-point-core" r="4.5"></circle>
      </g>`;
  }).join("");
  const metricControls = mode === "head" ? `
    <div class="replay-chart-metric" role="group" aria-label="${escapeHtml(t("analysis.replay.metricAria"))}">
      <button type="button" data-head-trajectory-metric="score" aria-pressed="${headTrajectoryMetric === "score"}">${escapeHtml(t("analysis.replay.metricScore"))}</button>
      <button type="button" data-head-trajectory-metric="margin" aria-pressed="${headTrajectoryMetric === "margin"}">${escapeHtml(t("analysis.replay.metricMargin"))}</button>
    </div>` : "";
  const markerValue = value => isMargin ? signedAnalysisNumber(value) : formatAnalysisNumber(value);
  return `
    <section id="${mode}-trajectory" class="replay-chapter replay-trajectory replay-reveal" data-replay-mode="${mode}" data-replay-chapter="trajectory">
      <header class="replay-chapter-heading">
        <h4>${escapeHtml(t("analysis.replay.chapterTrajectory"))}</h4>
        <p>${escapeHtml(t(isMargin ? "analysis.replay.trajectoryMarginDetail" : "analysis.replay.trajectoryDetail"))}</p>
      </header>
      ${metricControls}
      <div class="replay-chart-shell">
        <div class="replay-chart-scroll">
          <svg class="replay-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(t("analysis.scoreTrend"))}">
            ${grid}
            ${xTicks}
            <line class="replay-axis" x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${plotBottom}"></line>
            <line class="replay-axis" x1="${padLeft}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}"></line>
            <text class="replay-axis-title" x="${((padLeft + plotRight) / 2).toFixed(1)}" y="${height - 8}" text-anchor="middle">${escapeHtml(t(axisXKey))}</text>
            <text class="replay-axis-title" x="20" y="${axisCenterY.toFixed(1)}" text-anchor="middle" transform="rotate(-90 20 ${axisCenterY.toFixed(1)})">${escapeHtml(t(axisYKey))}</text>
            ${isMargin ? "" : `<polyline class="replay-chart-line" points="${pathPoints}"></polyline>`}
            ${rollingCoordinates.length ? `<polyline class="replay-chart-rolling ${isMargin ? "is-immediate" : ""}" pathLength="1" points="${rollingPathPoints}"></polyline>` : ""}
            ${isMargin && rollingCoordinates.length ? `
              <text class="replay-margin-endpoint" x="${rollingCoordinates[0].x.toFixed(1)}" y="${Math.max(padTop + 14, rollingCoordinates[0].y - 12).toFixed(1)}" text-anchor="start">${escapeHtml(t("analysis.replay.firstTenAverage", { value: signedAnalysisNumber(rollingCoordinates[0].score) }))}</text>
              <text class="replay-margin-endpoint latest" x="${rollingCoordinates.at(-1).x.toFixed(1)}" y="${Math.max(padTop + 14, rollingCoordinates.at(-1).y - 12).toFixed(1)}" text-anchor="end">${escapeHtml(t("analysis.replay.latestTenAverage", { value: signedAnalysisNumber(rollingCoordinates.at(-1).score) }))}</text>` : ""}
            ${dots}
            <path class="replay-recent-bracket" d="M ${bracketStart.toFixed(1)} ${bracketY - 7} V ${bracketY} H ${bracketEnd.toFixed(1)} V ${bracketY - 7}"></path>
            <text class="replay-recent-bracket-label" x="${((bracketStart + bracketEnd) / 2).toFixed(1)}" y="${bracketY + 18}" text-anchor="middle">${escapeHtml(t("analysis.replay.latestBracket", { count: recentCount }))}</text>
          </svg>
        </div>
        <div class="replay-chart-legend" aria-label="${escapeHtml(t("analysis.scoreTrend"))}">
          <span><i class="dots"></i>${escapeHtml(t(mode === "skills" ? "analysis.replay.legendSkillsDots" : isMargin ? "analysis.replay.legendMarginDots" : "analysis.replay.legendDots"))}</span>
          ${isMargin ? "" : `<span><i class="exact"></i>${escapeHtml(t("analysis.replay.legendTrend"))}</span>`}
          <span><i class="trend"></i>${escapeHtml(t(isMargin ? "analysis.replay.legendMarginRolling" : "analysis.replay.legendRolling"))}</span>
          <span><i class="recent"></i>${escapeHtml(t("analysis.replay.legendRecent", { count: recentCount }))}</span>
        </div>
        ${Number.isFinite(marginGrowth) ? `<p class="replay-margin-improvement">${escapeHtml(t("analysis.replay.marginImprovement", { value: signedAnalysisNumber(marginGrowth) }))}</p>` : ""}
        <p class="replay-point-readout" data-replay-point-readout>${escapeHtml(t("analysis.replay.pointHint"))}</p>
      </div>
      <dl class="replay-trajectory-markers">
        <div><dt>${escapeHtml(t("analysis.replay.startingLevel"))}</dt><dd>${escapeHtml(markerValue(trajectory.opening))}</dd></div>
        <div class="current"><dt>${escapeHtml(t("analysis.replay.currentLevel"))}</dt><dd>${escapeHtml(markerValue(trajectory.current))}</dd></div>
        <div><dt>${escapeHtml(t("analysis.replay.biggestTurn"))}</dt><dd>${escapeHtml(t("analysis.replay.dateTurn", { date: formatMatchDate(trajectory.turning.record), value: formatAnalysisNumber(Math.abs(trajectory.turning.delta)) }))}</dd></div>
      </dl>
    </section>`;
}

function replayTurningData(mode, records, story) {
  if (!story.comparison) return null;
  const labels = {
    autonSuccess: t("analysis.replay.whenWorking"),
    autonFailure: t("analysis.replay.whenMissing"),
    converted: t("analysis.replay.whenWorking"),
    gaveBack: t("analysis.replay.whenMissing"),
    centerOwned: t("analysis.replay.whenWorking"),
    centerNotOwned: t("analysis.replay.whenMissing"),
    yellowConverted: t("analysis.replay.whenWorking"),
    yellowMissed: t("analysis.replay.whenMissing"),
    zoneSecured: t("analysis.replay.whenWorking"),
    zoneLost: t("analysis.replay.whenMissing"),
    midfieldFinish: t("analysis.replay.whenWorking"),
    noMidfieldFinish: t("analysis.replay.whenMissing"),
    wins: t("history.result.win"),
    losses: t("history.result.loss"),
    centerComplete: t("analysis.replay.whenWorking"),
    centerMissed: t("analysis.replay.whenMissing")
  };
  return {
    positiveLabel: labels[story.comparison.positiveLabel] || t("analysis.replay.whenWorking"),
    negativeLabel: labels[story.comparison.negativeLabel] || t("analysis.replay.whenMissing"),
    withValue: story.comparison.positiveValue,
    withoutValue: story.comparison.negativeValue,
    swing: story.comparison.swing,
    metric: story.comparison.metric
  };
}

function renderReplayOpening(mode, records, story, trajectory) {
  const confidence = story.confidence === "strong"
    ? { label: t("analysis.replay.confidenceStrong"), tone: "strong" }
    : story.confidence === "developing"
      ? { label: t("analysis.replay.confidenceDeveloping"), tone: "developing" }
      : { label: t("analysis.replay.confidenceEarly"), tone: "early" };
  const team = profile?.teamName ? `${profile.teamNumber} ${profile.teamName}` : (profile?.teamNumber || "4330P");
  const count = countText(mode === "head" ? "analysis.matches" : "analysis.runs", records.length);
  return `
    <section class="replay-opening replay-reveal ${escapeHtml(trajectory.tone)}" data-replay-mode="${mode}" data-replay-chapter="opening">
      <div class="replay-opening-meta">
        <span>${escapeHtml(team)}</span>
        <span>${escapeHtml(replayRangeLabel())}</span>
        <span>${escapeHtml(count)}</span>
        <span class="${escapeHtml(confidence.tone)}">${escapeHtml(confidence.label)}</span>
      </div>
      <p class="replay-opening-intro">${escapeHtml(t("analysis.replay.intro"))}</p>
      <h3>${escapeHtml(story.title)}</h3>
      <div class="replay-opening-signal"><i></i><span>${escapeHtml(trajectory.summary)}</span></div>
    </section>`;
}

function renderReplayNav(mode) {
  const route = `${window.location.pathname}${window.location.search}`;
  const chapterHref = chapter => `${route}#${mode}-${chapter}`;
  return `
    <nav class="replay-chapter-nav" data-replay-nav="${mode}" aria-label="${escapeHtml(t("analysis.replay.title"))}">
      <a href="${escapeHtml(chapterHref("trajectory"))}" aria-current="step"><span>01</span>${escapeHtml(t("analysis.replay.chapterTrajectory"))}</a>
      <a href="${escapeHtml(chapterHref("turning"))}"><span>02</span>${escapeHtml(t("analysis.replay.chapterTurning"))}</a>
      <a href="${escapeHtml(chapterHref("anatomy"))}"><span>03</span>${escapeHtml(t(mode === "skills" ? "analysis.replay.chapterSkillsAnatomy" : "analysis.replay.chapterAnatomy"))}</a>
      <a href="${escapeHtml(chapterHref("practice"))}"><span>04</span>${escapeHtml(t("analysis.replay.chapterPractice"))}</a>
    </nav>`;
}

function renderReplayTurning(mode, records, story) {
  const data = replayTurningData(mode, records, story);
  const confidence = story.confidence === "strong"
    ? { label: t("analysis.replay.confidenceStrong"), tone: "strong" }
    : story.confidence === "developing"
      ? { label: t("analysis.replay.confidenceDeveloping"), tone: "developing" }
      : { label: t("analysis.replay.confidenceEarly"), tone: "early" };
  const metricLabel = data?.metric === "pins"
    ? t("analysis.correlationOption.ourPins")
    : data?.metric === "margin"
      ? t("analysis.correlationOption.margin")
      : t("analysis.replay.averageScoreShort");
  const comparison = data ? `
        <div class="replay-versus">
          <div class="positive"><span>${escapeHtml(data.positiveLabel)}</span><strong>${escapeHtml(formatAnalysisNumber(data.withValue))}</strong><small>${escapeHtml(metricLabel)}</small></div>
          <div class="replay-swing"><i></i><strong>${escapeHtml(t("analysis.replay.pointSwing", { value: formatAnalysisNumber(Math.abs(data.swing)) }))}</strong></div>
          <div class="negative"><span>${escapeHtml(data.negativeLabel)}</span><strong>${escapeHtml(formatAnalysisNumber(data.withoutValue))}</strong><small>${escapeHtml(metricLabel)}</small></div>
        </div>` : "";
  return `
    <section id="${mode}-turning" class="replay-chapter replay-turning replay-reveal" data-replay-mode="${mode}" data-replay-chapter="turning">
      <header class="replay-chapter-heading">
        <h4>${escapeHtml(t("analysis.replay.chapterTurning"))}</h4>
        <p>${escapeHtml(t("analysis.replay.turningDetail"))}</p>
      </header>
      <div class="replay-decision">
        <span class="replay-confidence ${escapeHtml(confidence.tone)}">${escapeHtml(confidence.label)}</span>
        <h5>${escapeHtml(story.title)}</h5>
        <p>${escapeHtml(story.why)}</p>
        ${comparison}
        <blockquote>${escapeHtml(story.proof)}</blockquote>
      </div>
    </section>`;
}

function replayFocusPhase(mode, key) {
  if (mode === "skills") {
    if (["driver", "auton", "balance"].includes(key)) return 0;
    if (["yellow", "center"].includes(key)) return 1;
    return 2;
  }
  if (key === "auton") return 0;
  if (["center", "yellow"].includes(key)) return 1;
  return 2;
}

function renderReplayAnatomy(mode, phases, story) {
  const focusIndex = replayFocusPhase(mode, story.key);
  return `
    <section id="${mode}-anatomy" class="replay-chapter replay-anatomy replay-reveal" data-replay-mode="${mode}" data-replay-chapter="anatomy">
      <header class="replay-chapter-heading">
        <h4>${escapeHtml(t(mode === "skills" ? "analysis.replay.chapterSkillsAnatomy" : "analysis.replay.chapterAnatomy"))}</h4>
        <p>${escapeHtml(t("analysis.replay.anatomyDetail"))}</p>
      </header>
      <div class="replay-phase-sequence">
        ${phases.map((phase, index) => `
          <article class="replay-phase${index === focusIndex ? " focus" : ""}">
            <span class="replay-phase-number">0${index + 1}</span>
            <div><small>${escapeHtml(phase.label)}</small><h5>${escapeHtml(phase.value)}</h5><p>${escapeHtml(phase.detail)}</p></div>
          </article>`).join("")}
      </div>
    </section>`;
}

function headPracticeMissions(story) {
  const pool = [
    { key: "auton", title: t("analysis.story.head.auton.title"), why: t("analysis.replay.missionHeadAutonWhy"), target: t("analysis.story.head.auton.target") },
    { key: "center", title: t("analysis.story.head.center.title"), why: t("analysis.replay.missionHeadCenterWhy"), target: t("analysis.story.head.center.target") },
    { key: "yellow", title: t("analysis.story.head.yellow.title"), why: t("analysis.replay.missionHeadYellowWhy"), target: t("analysis.story.head.yellow.target") },
    { key: "floor", title: t("analysis.story.head.floor.title"), why: t("analysis.replay.missionHeadFloorWhy"), target: t("analysis.story.head.floor.target") },
    { key: "review", title: t("analysis.story.missionReview"), why: t("analysis.replay.missionHeadReviewWhy"), target: t("analysis.story.missionReviewDetail") }
  ];
  const primary = { key: story.key, title: story.title, why: story.why, target: story.target, steps: story.steps };
  return [primary, ...pool.filter(item => item.key !== story.key)].slice(0, 3);
}

function skillsPracticeMissions(story) {
  const pool = [
    { key: "driver", title: t("analysis.story.skills.driver.title"), why: t("analysis.replay.missionSkillsDriverWhy"), target: t("analysis.story.skills.driver.target") },
    { key: "auton", title: t("analysis.story.skills.auton.title"), why: t("analysis.replay.missionSkillsAutonWhy"), target: t("analysis.story.skills.auton.target") },
    { key: "yellow", title: t("analysis.story.skills.yellow.title"), why: t("analysis.replay.missionSkillsYellowWhy"), target: t("analysis.story.skills.yellow.target") },
    { key: "center", title: t("analysis.story.skills.center.title"), why: t("analysis.replay.missionSkillsCenterWhy"), target: t("analysis.story.skills.center.target") },
    { key: "review", title: t("analysis.story.missionReview"), why: t("analysis.replay.missionSkillsReviewWhy"), target: t("analysis.story.missionReviewDetail") }
  ];
  const primary = { key: story.key, title: story.title, why: story.why, target: story.target, steps: story.steps };
  return [primary, ...pool.filter(item => item.key !== story.key)].slice(0, 3);
}

function renderReplayPractice(mode, missions) {
  return `
    <section id="${mode}-practice" class="replay-chapter replay-practice replay-reveal" data-replay-mode="${mode}" data-replay-chapter="practice">
      <header class="replay-chapter-heading">
        <h4>${escapeHtml(t("analysis.replay.chapterPractice"))}</h4>
        <p>${escapeHtml(t("analysis.replay.practiceDetail"))}</p>
      </header>
      <ol class="replay-missions">
        ${missions.map((mission, index) => `
          <li${index === 0 ? " class=\"primary\"" : ""}>
            <span>${String(index + 1).padStart(2, "0")}</span>
            <div><h5>${escapeHtml(mission.title)}</h5><p><b>${escapeHtml(t("analysis.replay.whyItMatters"))}:</b> ${escapeHtml(mission.why)}</p>${mission.steps ? `<ol class="replay-drill-steps">${mission.steps.map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol>` : ""}<p><b>${escapeHtml(t("analysis.replay.successTarget"))}:</b> ${escapeHtml(mission.target)}</p></div>
          </li>`).join("")}
      </ol>
    </section>`;
}

function renderEvidenceMetrics(items) {
  return `<dl class="replay-evidence-metrics">${items.map(item => `<div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd>${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ""}</div>`).join("")}</dl>`;
}

function renderHeadEvidence(matches) {
  const stats = analysisScoreStats(matches, match => match.ourScore);
  const wins = matches.filter(match => match.result === "win");
  const losses = matches.filter(match => match.result === "loss");
  const ties = matches.filter(match => match.result === "tie");
  const yellow = yellowEfficiencyValue(matches);
  const metrics = [
    { label: t("analysis.averageScore"), value: formatAnalysisNumber(stats.mean) },
    { label: t("analysis.winRate"), value: formatRate(percentRate(wins.length, matches.length)), detail: t("analysis.recordDetail", { wins: wins.length, losses: losses.length, ties: ties.length }) },
    { label: t("analysis.median"), value: formatAnalysisNumber(stats.median) },
    { label: t("analysis.best"), value: formatAnalysisNumber(stats.best) },
    { label: t("analysis.worst"), value: formatAnalysisNumber(stats.worst) },
    { label: t("analysis.yellowEfficiency"), value: formatRate(yellow.rate) }
  ];
  const comparisons = [
    { label: t("analysis.averageScore"), getter: match => match.ourScore },
    { label: t("analysis.autonReliability"), getter: autonWon, percent: true },
    { label: t("analysis.centerImpact"), getter: centerControlledByUs, percent: true },
    { label: t("analysis.yellowEfficiency"), getter: headYellowRate, percent: true },
    { label: t("analysis.correlationOption.margin"), getter: scoreMargin }
  ].map(item => {
    const winValue = resultAverage(wins, item.getter);
    const lossValue = resultAverage(losses, item.getter);
    return { ...item, winValue, lossValue, difference: Math.abs(winValue - lossValue) };
  }).filter(item => Number.isFinite(item.difference)).sort((a, b) => b.difference - a.difference).slice(0, 3);
  return `
    <h5>${escapeHtml(t("analysis.replay.numberProof"))}</h5>
    ${renderEvidenceMetrics(metrics)}
    <h5>${escapeHtml(t("analysis.replay.winLossProof"))}</h5>
    <div class="replay-comparison-list">
      ${comparisons.map(item => {
        const display = value => item.percent ? formatRate(value * 100) : formatAnalysisNumber(value);
        return `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(display(item.winValue))}</strong><i></i><strong>${escapeHtml(display(item.lossValue))}</strong></div>`;
      }).join("") || `<p>${escapeHtml(t("analysis.winFactorsEmpty"))}</p>`}
    </div>`;
}

function renderSkillsEvidence(runs) {
  const stats = analysisScoreStats(runs, run => run.score);
  const driver = runs.filter(run => run.skillsType === "driver");
  const auton = runs.filter(run => run.skillsType === "autonomous");
  const bestDriver = driver.length ? Math.max(...scoreGetterValues(driver, run => run.score)) : null;
  const bestAuton = auton.length ? Math.max(...scoreGetterValues(auton, run => run.score)) : null;
  return `
    <h5>${escapeHtml(t("analysis.replay.numberProof"))}</h5>
    ${renderEvidenceMetrics([
      { label: t("analysis.averageScore"), value: formatAnalysisNumber(stats.mean) },
      { label: t("analysis.median"), value: formatAnalysisNumber(stats.median) },
      { label: t("analysis.best"), value: formatAnalysisNumber(stats.best) },
      { label: t("analysis.worst"), value: formatAnalysisNumber(stats.worst) },
      { label: t("analysis.bestCombined"), value: formatAnalysisNumber((bestDriver || 0) + (bestAuton || 0)) },
      { label: t("analysis.yellowConversion"), value: formatRate(skillsYellowEfficiencyValue(runs).rate) }
    ])}
    <h5>${escapeHtml(t("analysis.replay.skillsProof"))}</h5>
    <div class="replay-route-proof">
      <div><span>${escapeHtml(t("skills.driver"))}</span><strong>${escapeHtml(formatAnalysisNumber(resultAverage(driver, run => run.score)))}</strong><small>${escapeHtml(t("analysis.driverAvg"))}</small></div>
      <i></i>
      <div><span>${escapeHtml(t("skills.autonomous"))}</span><strong>${escapeHtml(formatAnalysisNumber(resultAverage(auton, run => run.score)))}</strong><small>${escapeHtml(t("analysis.autonAvg"))}</small></div>
    </div>`;
}

function renderReplayEvidence(mode, records) {
  const correlation = mode === "head"
    ? renderCorrelation(records, headCorrelationOptions, headCorrelationX, headCorrelationY, "head")
    : renderCorrelation(records, skillsCorrelationOptions, skillsCorrelationX, skillsCorrelationY, "skills");
  return `
    <details class="replay-evidence-vault" ${analysisDisclosureState[mode].evidence ? "open" : ""}>
      <summary><span>${escapeHtml(t("analysis.replay.evidenceTitle"))}</span><small>${escapeHtml(t("analysis.replay.evidenceDetail"))}</small></summary>
      <div class="replay-evidence-body">
        ${mode === "head" ? renderHeadEvidence(records) : renderSkillsEvidence(records)}
        ${correlation}
      </div>
    </details>`;
}

function renderReplayEmpty(mode, allRecords) {
  const rangeEmpty = allRecords.length > 0;
  return `
    <section class="replay-empty">
      <span>${escapeHtml(t("analysis.replay.kicker"))}</span>
      <h3>${escapeHtml(t("analysis.replay.noDataTitle"))}</h3>
      <p>${escapeHtml(rangeEmpty ? t("analysis.noRange") : t(mode === "head" ? "analysis.replay.noHeadData" : "analysis.replay.noSkillsData"))}</p>
    </section>`;
}

function renderSeasonReplay(mode, allRecords, records) {
  const mount = $(`[data-analysis-${mode === "head" ? "head" : "skills"}-replay]`);
  if (!mount) return;
  if (!records.length) {
    mount.innerHTML = renderReplayEmpty(mode, allRecords);
    return;
  }
  const scoreGetter = mode === "head" ? match => match.ourScore : run => run.score;
  const timelineGetter = mode === "head" && headTrajectoryMetric === "margin"
    ? match => numericValue(match.ourScore) - numericValue(match.opponentScore)
    : scoreGetter;
  const story = mode === "head" ? rankedHeadRecommendation(records) : rankedSkillsRecommendation(records);
  const storyTrajectory = replayTrajectory(records, scoreGetter);
  const timelineTrajectory = mode === "head" && headTrajectoryMetric === "margin"
    ? replayRollingTrajectory(records, timelineGetter, 10)
    : replayTrajectory(records, timelineGetter);
  const phases = mode === "head" ? headProofCards(records, allRecords) : skillsProofCards(records);
  const missions = mode === "head" ? headPracticeMissions(story) : skillsPracticeMissions(story);
  mount.innerHTML = `
    ${renderReplayOpening(mode, records, story, storyTrajectory)}
    ${renderReplayNav(mode)}
    ${renderReplayTimeline(mode, records, timelineGetter, timelineTrajectory)}
    ${renderReplayTurning(mode, records, story)}
    ${renderReplayAnatomy(mode, phases, story)}
    ${renderReplayPractice(mode, missions)}
    ${renderReplayEvidence(mode, records)}`;
}

function initReplayMotion() {
  replayObserver?.disconnect();
  const active = $(".season-replay.is-active-analysis-section");
  if (!active) return;
  const sections = [...active.querySelectorAll(".replay-reveal")];
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) {
    sections.forEach(section => section.classList.add("is-visible"));
    return;
  }
  replayObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      const chapter = entry.target.dataset.replayChapter;
      const mode = entry.target.dataset.replayMode;
      if (chapter && chapter !== "opening") {
        $$(`[data-replay-nav="${mode}"] a`).forEach((link) => {
          const current = new URL(link.href, window.location.href).hash === `#${mode}-${chapter}`;
          if (current) link.setAttribute("aria-current", "step");
          else link.removeAttribute("aria-current");
        });
      }
    });
  }, { threshold: .22, rootMargin: "0px 0px -12% 0px" });
  sections.forEach(section => replayObserver.observe(section));
}

function updateReplayPointReadout(target) {
  const point = target?.closest?.("[data-replay-point]");
  if (!point) return;
  const readout = point.closest(".replay-chart-shell")?.querySelector("[data-replay-point-readout]");
  if (readout) readout.textContent = point.dataset.replayPoint || "";
}

function renderHeadAnalysis(allMatches, matches) {
  renderSeasonReplay("head", allMatches, matches);
}

function renderSkillsAnalysis(allRuns, runs) {
  renderSeasonReplay("skills", allRuns, runs);
}

function captureAnalysisDisclosureState() {
  ["head", "skills"].forEach((mode) => {
    const mount = $(`[data-analysis-${mode === "head" ? "head" : "skills"}-replay]`);
    const evidence = mount?.querySelector(".replay-evidence-vault");
    const correlation = mount?.querySelector(".analysis-correlation-lab");
    if (evidence) analysisDisclosureState[mode].evidence = evidence.open;
    if (correlation) analysisDisclosureState[mode].correlation = correlation.open;
  });
}

function renderAnalysis() {
  captureAnalysisDisclosureState();
  renderAnalysisMode();
  renderAnalysisRange();
  const headMatches = sortedHeadMatches();
  const skillsRuns = sortedSkillsRuns();
  renderHeadAnalysis(headMatches, filterAnalysisRecords(headMatches));
  renderSkillsAnalysis(skillsRuns, filterAnalysisRecords(skillsRuns));
  requestAnimationFrame(initReplayMotion);
}

function formatMatchDate(match) {
  if (match.savedDate) return match.savedDate;
  const date = new Date(match.savedAt || Date.now());
  return date.toLocaleDateString(languageLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatMatchTime(match) {
  if (!match.savedAt) return t("history.savedMatch");
  return new Date(match.savedAt).toLocaleTimeString(languageLocale(), {
    hour: "numeric",
    minute: "2-digit"
  });
}

function matchResultLabel(match) {
  if (["win", "loss", "tie"].includes(match.result)) return t(`history.result.${match.result}`);
  return t("history.result.saved");
}

function scoreForSummary(match) {
  if (Number.isFinite(match.ourScore) && Number.isFinite(match.opponentScore)) {
    return { left: match.ourScore, right: match.opponentScore };
  }
  return { left: match.redScore ?? 0, right: match.blueScore ?? 0 };
}

function detailValue(value) {
  const text = String(value || "").trim();
  return text || t("common.notEntered");
}

function hasDetail(...values) {
  return values.some(value => String(value || "").trim());
}

function optionalDetailBox(label, primary, notes) {
  if (!hasDetail(primary, notes)) return "";
  return `
    <div class="detail-box wide">
      <span>${escapeHtml(label)}</span>
      ${String(primary || "").trim() ? `<p>${escapeHtml(primary)}</p>` : ""}
      ${String(notes || "").trim() ? `<p>${escapeHtml(notes)}</p>` : ""}
    </div>
  `;
}

function historyCounter(color, value = 0) {
  return `
    <div class="history-counter ${color}">
      <i>-</i><strong>${Number(value || 0)}</strong><i>+</i>
    </div>
  `;
}

function historyStack(name, scorer) {
  const q = scorer?.quadrants?.[name] || { yellow: 0, red: 0, blue: 0 };
  return `
    <div class="history-stack ${name}">
      ${historyCounter("yellow", q.yellow)}
      ${historyCounter("red", q.red)}
      ${historyCounter("blue", q.blue)}
    </div>
  `;
}

function historyStackWithColors(name, scorer, stackColors, extraClass = "") {
  const q = scorer?.quadrants?.[name] || { yellow: 0, red: 0, blue: 0 };
  return `
    <div class="history-stack ${extraClass} ${name}">
      ${stackColors.map(color => historyCounter(color, q[color])).join("")}
    </div>
  `;
}

function historyRobotClass(id, active) {
  const color = id.startsWith("red") ? "red" : "blue";
  const position = ({
    "red-1": "r1",
    "red-2": "r2",
    "blue-1": "b1",
    "blue-2": "b2"
  })[id];
  return `history-robot ${color} ${position} ${active ? "active" : ""}`;
}

function renderHistoryField(match) {
  const scorer = match.scorer || {};
  const q = scorer.quadrants || {};
  const robots = scorer.robots || {};
  return `
    <div class="history-field" aria-label="Saved field snapshot">
      <div class="history-field-board">
        <div class="history-diamond"></div>
        <span class="history-toggle top ${q.top?.toggle || "neutral"}"></span>
        <span class="history-toggle right ${q.right?.toggle || "neutral"}"></span>
        <span class="history-toggle bottom ${q.bottom?.toggle || "neutral"}"></span>
        <span class="history-toggle left ${q.left?.toggle || "neutral"}"></span>
        ${["top", "right", "bottom", "left", "center"].map(name => historyStack(name, scorer)).join("")}
        ${Object.keys({ "red-1": 1, "red-2": 1, "blue-1": 1, "blue-2": 1 }).map(id => (
          `<span class="${historyRobotClass(id, Boolean(robots[id]))}"></span>`
        )).join("")}
      </div>
    </div>
  `;
}

function renderSkillsHistoryField(run) {
  const skills = run.skills || {};
  const q = skills.quadrants || {};
  const toggles = skills.toggles || {};
  return `
    <div class="history-field" aria-label="Saved Skills field snapshot">
      <div class="history-field-board skills-history-field-board">
        <span class="skills-history-zone blue top"></span>
        <span class="skills-history-zone blue right"></span>
        <span class="skills-history-zone red bottom"></span>
        <span class="skills-history-zone red left"></span>
        <div class="history-diamond"></div>
        <span class="history-toggle top ${toggles.top || "neutral"}"></span>
        <span class="history-toggle right ${toggles.right || "neutral"}"></span>
        <span class="history-toggle bottom ${toggles.bottom || "neutral"}"></span>
        <span class="history-toggle left ${toggles.left || "neutral"}"></span>
        <span class="skills-history-center-toggle ${skills.centerToggle ? "active" : ""}"></span>
        ${historyStackWithColors("top", { quadrants: q }, ["yellow", "blue"], "skills-snapshot-stack")}
        ${historyStackWithColors("right", { quadrants: q }, ["yellow", "blue"], "skills-snapshot-stack")}
        ${historyStackWithColors("bottom", { quadrants: q }, ["yellow", "red"], "skills-snapshot-stack")}
        ${historyStackWithColors("left", { quadrants: q }, ["yellow", "red"], "skills-snapshot-stack")}
        ${historyStackWithColors("center", { quadrants: q }, ["yellow", "red", "blue"], "skills-snapshot-stack")}
      </div>
    </div>
  `;
}

function renderMatchDetails(match) {
  const details = match.details || {};
  const alliance = match.teamAlliance ? t(`color.${match.teamAlliance}`) : t("common.notSaved");
  return `
    <div class="detail-grid">
      <div class="detail-box">
        <span>${escapeHtml(t("history.team"))}</span>
        <strong>${escapeHtml(match.teamNumber || t("common.notSaved"))}</strong>
      </div>
      <div class="detail-box">
        <span>${escapeHtml(t("history.alliance"))}</span>
        <strong>${escapeHtml(alliance)}</strong>
      </div>
      <div class="detail-box">
        <span>${escapeHtml(t("history.ourScore"))}</span>
        <strong>${escapeHtml(match.ourScore ?? match.redScore ?? 0)}</strong>
      </div>
      <div class="detail-box">
        <span>${escapeHtml(t("history.opponentScore"))}</span>
        <strong>${escapeHtml(match.opponentScore ?? match.blueScore ?? 0)}</strong>
      </div>
      ${optionalDetailBox(t("history.partner"), details.partnerTeam, details.partnerNotes)}
      ${optionalDetailBox(t("history.opponentOne"), details.opponentOne, details.opponentOneNotes)}
      ${optionalDetailBox(t("history.opponentTwo"), details.opponentTwo, details.opponentTwoNotes)}
      ${isDevMode ? `
        <div class="detail-box wide">
          <span>${escapeHtml(t("dev.tools"))}</span>
          <div class="history-dev-actions">
            <button class="dev-button" type="button" data-dev-edit-match="${escapeHtml(match.id)}">${escapeHtml(t("dev.editJson"))}</button>
            <button class="dev-button danger" type="button" data-dev-delete-match="${escapeHtml(match.id)}">${escapeHtml(t("history.deleteMatch"))}</button>
          </div>
        </div>
      ` : ""}
    </div>
    ${renderHistoryField(match)}
  `;
}

function renderHistoryCard(match) {
  const resultKey = ["win", "loss", "tie"].includes(match.result) ? match.result : "saved";
  const result = matchResultLabel(match);
  const score = scoreForSummary(match);
  const open = expandedMatchId === match.id;
  const confirmingDelete = pendingDeleteMatchId === match.id;
  return `
    <article class="history-card ${open ? "open" : ""}">
      <div class="history-summary">
        <button class="history-main" type="button" data-history-toggle="${escapeHtml(match.id)}" aria-expanded="${open}">
          <span class="history-date">
            ${escapeHtml(formatMatchDate(match))}
            <small>${escapeHtml(formatMatchTime(match))}</small>
          </span>
          <span class="history-score">
            <strong>${escapeHtml(score.left)}</strong><span>-</span><strong>${escapeHtml(score.right)}</strong>
          </span>
          <span class="result-pill ${escapeHtml(resultKey)}">${escapeHtml(result)}</span>
        </button>
        <button class="history-delete ${confirmingDelete ? "confirming" : ""}" type="button" data-delete-match="${escapeHtml(match.id)}">
          ${confirmingDelete ? escapeHtml(t("history.confirmDelete")) : escapeHtml(t("history.deleteMatch"))}
        </button>
      </div>
      <div class="history-detail">
        ${open ? renderMatchDetails(match) : ""}
      </div>
    </article>
  `;
}

function skillsTypeLabel(type) {
  if (type === "driver") return t("skills.driver");
  if (type === "autonomous") return t("skills.autonomous");
  return t("tabs.skills");
}

function renderSkillsRunDetails(run) {
  const notes = String(run.notes || "").trim();
  return `
    <div class="detail-grid">
      <div class="detail-box compact">
        <span>${escapeHtml(t("history.team"))}</span>
        <strong>${escapeHtml(run.teamNumber || t("common.notSaved"))}</strong>
      </div>
      <div class="detail-box compact">
        <span>${escapeHtml(t("history.runType"))}</span>
        <strong>${escapeHtml(skillsTypeLabel(run.skillsType))}</strong>
      </div>
      <div class="detail-box compact">
        <span>${escapeHtml(t("skills.score"))}</span>
        <strong>${escapeHtml(run.score ?? 0)}</strong>
      </div>
      ${notes ? `
        <div class="detail-box wide">
          <span>${escapeHtml(t("history.notes"))}</span>
          <p>${escapeHtml(notes)}</p>
        </div>
      ` : ""}
    </div>
    ${renderSkillsHistoryField(run)}
  `;
}

function renderSkillsRunCard(run) {
  const open = expandedSkillsRunId === run.id;
  return `
    <article class="history-card skills-run-card ${open ? "open" : ""}">
      <button class="history-summary skills-history-summary" type="button" data-skills-history-toggle="${escapeHtml(run.id)}" aria-expanded="${open}">
        <span class="history-date">
          ${escapeHtml(formatMatchDate(run))}
          <small>${escapeHtml(formatMatchTime(run))}</small>
        </span>
        <span class="skills-run-type">${escapeHtml(skillsTypeLabel(run.skillsType))}</span>
        <span class="history-score skills-run-score">
          <strong>${escapeHtml(run.score ?? 0)}</strong>
        </span>
      </button>
      <div class="history-detail">
        ${open ? renderSkillsRunDetails(run) : ""}
      </div>
    </article>
  `;
}

function renderHistory() {
  const list = $("[data-history-list]");
  const more = $("[data-history-more]");
  renderBanner();
  if (!list || !more) return;

  const devPanel = $("[data-dev-panel]");
  if (devPanel) devPanel.hidden = !isDevMode;
  renderDevDiagnostics();

  const matches = sortedHeadMatches();
  if (!matches.length) {
    list.innerHTML = `<p class="history-empty">${escapeHtml(t("history.matchEmpty"))}</p>`;
    more.hidden = true;
    return;
  }

  const visible = showAllHistory ? matches : matches.slice(0, HISTORY_INITIAL_LIMIT);
  list.innerHTML = visible.map(renderHistoryCard).join("");
  more.hidden = matches.length <= HISTORY_INITIAL_LIMIT;
  more.textContent = showAllHistory ? t("history.showLess") : t("history.showMore");
}

function renderSkillsHistory() {
  const list = $("[data-skills-history-list]");
  const more = $("[data-skills-history-more]");
  if (!list || !more) return;

  const runs = sortedSkillsRuns();
  if (!runs.length) {
    list.innerHTML = `<p class="history-empty">${escapeHtml(t("history.skillsEmpty"))}</p>`;
    more.hidden = true;
    return;
  }

  const visible = showAllSkillsHistory ? runs : runs.slice(0, HISTORY_INITIAL_LIMIT);
  list.innerHTML = visible.map(renderSkillsRunCard).join("");
  more.hidden = runs.length <= HISTORY_INITIAL_LIMIT;
  more.textContent = showAllSkillsHistory ? t("history.showLess") : t("history.showMore");
}

function deleteMatch(id) {
  const nextMatches = savedMatches().filter(match => match.id !== id);
  writeSavedMatches(nextMatches);
  if (expandedMatchId === id) expandedMatchId = null;
  if (expandedSkillsRunId === id) expandedSkillsRunId = null;
  if (pendingDeleteMatchId === id) pendingDeleteMatchId = null;
  renderHistory();
  renderSkillsHistory();
  renderAnalysis();
  showToast(t("toast.matchDeleted"));
}

function requestDeleteMatch(id) {
  if (pendingDeleteMatchId === id) {
    deleteMatch(id);
    return;
  }
  pendingDeleteMatchId = id;
  renderHistory();
  showToast(t("toast.confirmDelete"));
}

function clearMatches() {
  writeSavedMatches([]);
  expandedMatchId = null;
  expandedSkillsRunId = null;
  showAllHistory = false;
  showAllSkillsHistory = false;
  renderHistory();
  renderSkillsHistory();
  renderAnalysis();
  showToast(t("toast.matchesCleared"));
}

function wipeAllData() {
  localStorage.removeItem(MATCH_STORE_KEY);
  localStorage.removeItem(PROFILE_STORE_KEY);
  localStorage.removeItem(COMPETITION_STORE_KEY);
  localStorage.removeItem(DEV_AUTOFILL_STORE_KEY);
  devAutofillState = {};
  lastDevHeadRecommendation = "";
  lastDevSkillsRecommendation = "";
  profile = null;
  importedCompetition = null;
  expandedMatchId = null;
  expandedSkillsRunId = null;
  showAllHistory = false;
  showAllSkillsHistory = false;
  renderHistory();
  renderSkillsHistory();
  renderAnalysis();
  renderImportedCompetition();
  openSetupModal();
  showToast(t("toast.localWiped"));
}

function openDevEditor(id) {
  const match = savedMatches().find(item => item.id === id);
  const modal = $("[data-dev-edit-modal]");
  const form = $("[data-dev-edit-form]");
  if (!match || !modal || !form) return;
  editingMatchId = id;
  form.elements.matchJson.value = JSON.stringify(match, null, 2);
  modal.hidden = false;
  document.body.classList.add("modal-open");
  form.elements.matchJson.focus();
}

function closeDevEditor() {
  const modal = $("[data-dev-edit-modal]");
  if (!modal) return;
  modal.hidden = true;
  editingMatchId = null;
  document.body.classList.remove("modal-open");
}

function saveDevEdit() {
  const form = $("[data-dev-edit-form]");
  if (!form || !editingMatchId) return;
  let edited;
  try {
    edited = JSON.parse(form.elements.matchJson.value);
  } catch {
    showToast(t("toast.invalidJson"));
    return;
  }

  if (!edited || typeof edited !== "object" || !edited.id) {
    showToast(t("toast.editNeedsId"));
    return;
  }

  const matches = savedMatches();
  const index = matches.findIndex(match => match.id === editingMatchId);
  if (index === -1) return;
  matches[index] = edited;
  writeSavedMatches(matches);
  expandedMatchId = edited.id;
  expandedSkillsRunId = edited.id;
  closeDevEditor();
  renderHistory();
  renderSkillsHistory();
  renderAnalysis();
  showToast(t("toast.matchUpdated"));
}

function resetScorer() {
  state.auton = "none";
  Object.keys(state.robots).forEach(robot => {
    state.robots[robot] = false;
  });
  quadrants.forEach(quadrant => {
    state.quadrants[quadrant] = { toggle: "neutral", yellow: 0, red: 0, blue: 0 };
  });
  teamAlliance = "none";
  render();
}

function resetSkillsScorer() {
  skillsState.centerToggle = false;
  Object.keys(skillsState.toggles).forEach(quadrant => {
    skillsState.toggles[quadrant] = "neutral";
  });
  skillsQuadrants.forEach(quadrant => {
    skillsState.quadrants[quadrant] = { yellow: 0, red: 0, blue: 0 };
  });
  skillsRunType = "none";
  renderSkills();
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-save-open]")) openSaveModal();
  if (event.target.closest("[data-save-close]")) closeSaveModal();
  if (event.target.closest("[data-save-skip]")) saveCurrentMatch(blankDetails());
  if (event.target === $("[data-save-modal]")) closeSaveModal();
  if (event.target.closest("[data-skills-save-open]")) openSkillsSaveModal();
  if (event.target.closest("[data-skills-save-close]")) closeSkillsSaveModal();
  if (event.target.closest("[data-skills-save-skip]")) saveCurrentSkillsRun("");
  if (event.target === $("[data-skills-save-modal]")) closeSkillsSaveModal();

  const modeChoice = event.target.closest("[data-mode-choice]");
  if (modeChoice) {
    setMode(modeChoice.dataset.modeChoice);
    return;
  }

  const skillsType = event.target.closest("[data-skills-type]");
  if (skillsType) {
    setSkillsRunType(skillsType.dataset.skillsType);
    return;
  }

  const skillsStep = event.target.closest("[data-skills-step]");
  if (skillsStep) {
    const [quadrant, color, amount] = skillsStep.dataset.skillsStep.split(":");
    stepSkillsCounter(quadrant, color, Number(amount));
    return;
  }

  if (event.target.closest("[data-skills-center-toggle]")) {
    toggleSkillsCenter();
    return;
  }

  const skillsToggle = event.target.closest("[data-skills-toggle]");
  if (skillsToggle) {
    cycleSkillsToggle(skillsToggle.dataset.skillsToggle);
    return;
  }

  if (event.target.closest("[data-history-more]")) {
    showAllHistory = !showAllHistory;
    renderHistory();
  }

  if (event.target.closest("[data-skills-history-more]")) {
    showAllSkillsHistory = !showAllSkillsHistory;
    renderSkillsHistory();
  }

  if (isDevMode && event.target.closest("[data-dev-clear-matches]")) clearMatches();
  if (isDevMode && event.target.closest("[data-dev-clear-all]")) wipeAllData();
  if (isDevMode && event.target.closest("[data-dev-seed-matches]")) seedSampleData();

  const devDelete = event.target.closest("[data-dev-delete-match]");
  if (isDevMode && devDelete) deleteMatch(devDelete.dataset.devDeleteMatch);

  const deleteButton = event.target.closest("[data-delete-match]");
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    requestDeleteMatch(deleteButton.dataset.deleteMatch);
    return;
  }

  const devEdit = event.target.closest("[data-dev-edit-match]");
  if (isDevMode && devEdit) openDevEditor(devEdit.dataset.devEditMatch);

  if (event.target.closest("[data-dev-edit-close]")) closeDevEditor();
  if (event.target === $("[data-dev-edit-modal]")) closeDevEditor();

  const historyToggle = event.target.closest("[data-history-toggle]");
  if (historyToggle) {
    const id = historyToggle.dataset.historyToggle;
    expandedMatchId = expandedMatchId === id ? null : id;
    renderHistory();
  }

  const skillsHistoryToggle = event.target.closest("[data-skills-history-toggle]");
  if (skillsHistoryToggle) {
    const id = skillsHistoryToggle.dataset.skillsHistoryToggle;
    expandedSkillsRunId = expandedSkillsRunId === id ? null : id;
    renderSkillsHistory();
  }

  const regionOption = event.target.closest("[data-region-option]");
  if (regionOption) {
    selectCompetitionRegion(regionOption.dataset.regionOption, regionOption.querySelector("strong")?.textContent || "");
    searchCompetitions(competitionFilterValues().query).catch((error) => {
      setCompetitionStatus(error.message || t("scouting.dataError"), "warn");
    });
    return;
  }

  if (!event.target.closest("[data-region-combobox]")) {
    renderRegionOptions(false);
  }

  const competitionTeamToggle = event.target.closest("[data-competition-team-toggle]");
  if (competitionTeamToggle) {
    const id = competitionTeamToggle.dataset.competitionTeamToggle;
    expandedCompetitionTeam = expandedCompetitionTeam === id ? null : id;
    renderImportedCompetition();
    return;
  }

  const teamSkillToggle = event.target.closest("[data-team-skill-toggle]");
  if (teamSkillToggle) {
    const id = teamSkillToggle.dataset.teamSkillToggle;
    expandedTeamSkillId = expandedTeamSkillId === id ? null : id;
    renderTeamSkillsResults(teamSkillsResults);
    return;
  }

  const importButton = event.target.closest("[data-import-event]");
  if (importButton) {
    importButton.disabled = true;
    importCompetition(importButton.dataset.importEvent).then(() => {
      importButton.disabled = false;
    }).catch((error) => {
      importButton.disabled = false;
      setCompetitionStatus(error.message || t("scouting.dataError"), "warn");
      showToast(t("scouting.dataError"));
    });
    return;
  }

  const auton = event.target.closest("[data-auton]");
  if (auton) setAuton(auton.dataset.auton);

  const toggle = event.target.closest("[data-toggle]");
  if (toggle) cycleToggle(toggle.dataset.toggle);

  const step = event.target.closest("[data-step]");
  if (step) {
    const [quadrant, color, amount] = step.dataset.step.split(":");
    stepCounter(quadrant, color, Number(amount));
  }

  const robot = event.target.closest("[data-robot]");
  if (robot) toggleRobot(robot.dataset.robot);

  const alliance = event.target.closest("[data-team-alliance]");
  if (alliance) setTeamAlliance(alliance.dataset.teamAlliance);

  if (event.target.closest("[data-reset]")) resetScorer();
});

document.addEventListener("pointerover", (event) => updateReplayPointReadout(event.target));
document.addEventListener("focusin", (event) => updateReplayPointReadout(event.target));

$("[data-save-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCurrentMatch(formDetails());
});

$("[data-skills-save-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const notes = String(new FormData(event.currentTarget).get("notes") || "").trim();
  saveCurrentSkillsRun(notes);
});

$("[data-setup-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = String(new FormData(event.currentTarget).get("teamNumber") || "").trim();
  if (!value) {
    showToast(t("toast.enterTeam"));
    return;
  }
  clearSetupConfirmation();
  const submit = $("[data-setup-submit]");
  if (submit) {
    submit.disabled = true;
    submit.textContent = t("setup.checking");
  }
  const match = await findTeamIdentity(value);
  if (submit) {
    submit.disabled = false;
    submit.textContent = t("setup.checkTeam");
  }
  if (match?.teamName) {
    renderSetupConfirmation(match);
    return;
  }
  finishProfileSetup(saveProfile(value));
});

$("[data-setup-form] input[name='teamNumber']")?.addEventListener("input", clearSetupConfirmation);

$("[data-setup-confirm-yes]")?.addEventListener("click", () => {
  if (!pendingProfileMatch) return;
  finishProfileSetup(saveProfile(
    pendingProfileMatch.teamNumber,
    pendingProfileMatch.teamName,
    pendingProfileMatch.teamSource
  ));
});

$("[data-setup-confirm-no]")?.addEventListener("click", () => {
  clearSetupConfirmation();
  const input = $("[data-setup-form] input[name='teamNumber']");
  input?.focus();
  input?.select();
});

$("[data-dev-edit-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (isDevMode) saveDevEdit();
});

$("[data-competition-search-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = String(new FormData(event.currentTarget).get("competitionSearch") || "").trim();
  searchCompetitions(query).catch((error) => {
    setCompetitionStatus(error.message || t("scouting.dataError"), "warn");
    showToast(t("scouting.dataError"));
  });
});

$("[data-competition-region-input]")?.addEventListener("input", () => {
  selectedCompetitionRegion = "";
  const hidden = $("[data-competition-region]");
  if (hidden) hidden.value = "";
  highlightedRegionIndex = 0;
  renderRegionOptions(true);
});

$("[data-competition-region-input]")?.addEventListener("focus", () => {
  renderRegionOptions(true);
});

$("[data-competition-region-input]")?.addEventListener("keydown", (event) => {
  const rows = visibleRegionRows();
  if (event.key === "ArrowDown") {
    event.preventDefault();
    highlightedRegionIndex = Math.min(highlightedRegionIndex + 1, Math.max(rows.length - 1, 0));
    renderRegionOptions(true);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    highlightedRegionIndex = Math.max(highlightedRegionIndex - 1, 0);
    renderRegionOptions(true);
  } else if (event.key === "Enter") {
    event.preventDefault();
    commitRegionInput();
    searchCompetitions(competitionFilterValues().query).catch((error) => {
      setCompetitionStatus(error.message || t("scouting.dataError"), "warn");
    });
  } else if (event.key === "Escape") {
    renderRegionOptions(false);
  }
});

$("[data-competition-search-form] input[name='competitionSearch']")?.addEventListener("input", (event) => {
  const value = String(event.currentTarget.value || "").trim();
    searchCompetitions(value).catch((error) => {
    setCompetitionStatus(error.message || t("scouting.dataError"), "warn");
  });
});

$$("[data-competition-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    competitionQuickFilter = button.dataset.competitionFilter || "all";
    renderCompetitionFilters();
    searchCompetitions(competitionFilterValues().query).catch((error) => {
      setCompetitionStatus(error.message || t("scouting.dataError"), "warn");
    });
  });
});

$$("[data-analysis-range]").forEach((button) => {
  button.addEventListener("click", () => {
    analysisRange = button.dataset.analysisRange || "all";
    renderAnalysis();
  });
});

$$("[data-analysis-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    analysisMode = button.dataset.analysisMode === "skills" ? "skills" : "head";
    renderAnalysis();
  });
});

document.addEventListener("click", (event) => {
  const metricButton = event.target.closest("[data-head-trajectory-metric]");
  if (!metricButton) return;
  headTrajectoryMetric = metricButton.dataset.headTrajectoryMetric === "margin" ? "margin" : "score";
  renderAnalysis();
});

$("[data-analysis-start]")?.addEventListener("change", renderAnalysis);
$("[data-analysis-end]")?.addEventListener("change", renderAnalysis);

document.addEventListener("change", (event) => {
  const languageSelect = event.target.closest("[data-language-select]");
  if (languageSelect) {
    setLanguage(languageSelect.value);
    return;
  }

  const select = event.target.closest("[data-correlation-axis]");
  if (!select) return;
  const [mode, axis] = select.dataset.correlationAxis.split(":");
  if (mode === "head" && axis === "x") headCorrelationX = select.value;
  if (mode === "head" && axis === "y") headCorrelationY = select.value;
  if (mode === "skills" && axis === "x") skillsCorrelationX = select.value;
  if (mode === "skills" && axis === "y") skillsCorrelationY = select.value;
  renderAnalysis();
});

$("[data-team-skills-search-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = String(new FormData(event.currentTarget).get("teamSkillsSearch") || "").trim();
  if (query.length < 2) {
    setTeamSkillsStatus(t("scouting.typeTwo"), "warn");
    return;
  }
  searchTeamSkills(query).catch((error) => {
    setTeamSkillsStatus(error.message || t("scouting.skillsError"), "warn");
    showToast(t("scouting.skillsError"));
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("[data-save-modal]")?.hidden) {
    closeSaveModal();
  }
  if (event.key === "Escape" && !$("[data-skills-save-modal]")?.hidden) {
    closeSkillsSaveModal();
  }
  if (event.key === "Escape" && !$("[data-dev-edit-modal]")?.hidden) {
    closeDevEditor();
  }
});

initializeJudgeWorkspace();
applyI18n();
buildCounters();
renderMode();
render();
renderSkills();
renderHistory();
renderSkillsHistory();
renderAnalysis();
renderImportedCompetition();
ensureSyncedEventsLoaded().then(() => initializeJudgeScouting()).catch(() => {});
initializeProfileGate();
