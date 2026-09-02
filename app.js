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
const PROXY_URL_STORE_KEY = "vexOverrideDataProxyUrl:v1";
const SEASON_SKILLS_STORE_KEY = "vexOverrideSeasonSkills:v1";
const LANGUAGE_STORE_KEY = "vexOverrideLanguage:v1";
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
const isDevMode = new URLSearchParams(window.location.search).get("dev") === "1" || window.location.hash === "#dev";
let profile = loadProfile();
let activeMode = "head";
let analysisRange = "all";
let analysisMode = "head";
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
    "scouting.skillsKicker": "Official Skills standings",
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
  "scouting.skillsKicker": "Clasificación oficial de Skills",
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
  "scouting.skillsKicker": "官方技能赛排名",
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
  renderScouting();
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

function savedMatches() {
  try {
    const matches = JSON.parse(localStorage.getItem(MATCH_STORE_KEY));
    return Array.isArray(matches) ? matches : [];
  } catch {
    return [];
  }
}

function writeSavedMatches(matches) {
  localStorage.setItem(MATCH_STORE_KEY, JSON.stringify(matches));
}

function loadCompetitionData() {
  try {
    const saved = JSON.parse(localStorage.getItem(COMPETITION_STORE_KEY));
    return saved && typeof saved === "object" ? saved : null;
  } catch {
    return null;
  }
}

function writeCompetitionData(competition) {
  localStorage.setItem(COMPETITION_STORE_KEY, JSON.stringify(competition));
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
  if (!team || !count || !record) return;

  const matches = savedMatches().filter(isHeadMatch);
  const summary = matchRecordSummary(matches);
  team.textContent = profile?.teamName ? `${profile.teamNumber} ${profile.teamName}` : (profile?.teamNumber || "4330P");
  count.textContent = String(matches.length);
  record.textContent = `${summary.wins}-${summary.losses}-${summary.ties}`;
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
    if (cached && Array.isArray(cached.skills)) return cached.skills;
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
    const saved = JSON.parse(localStorage.getItem(PROFILE_STORE_KEY));
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
  localStorage.setItem(PROFILE_STORE_KEY, JSON.stringify(nextProfile));
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

function sampleHeadSeed(index, total) {
  const progress = total <= 1 ? 1 : index / (total - 1);
  const daysAgoValue = Math.round((1 - progress) * 104);
  const teamAlliance = index % 2 === 0 ? "blue" : "red";
  const roughMatch = index % 11 === 2 || index % 13 === 5;
  const closeLoss = index % 7 === 3 || index % 17 === 8;
  const upsetWin = index % 19 === 11;
  const strong = Math.min(1, Math.max(0, progress + (upsetWin ? .18 : 0) - (roughMatch ? .24 : 0)));
  const ourColor = teamAlliance;
  const opponentColor = teamAlliance === "red" ? "blue" : "red";
  const noise = seededRandom(index + 31);
  const ourBase = 1 + Math.floor(strong * 5) + (noise > .78 ? 1 : 0);
  const oppBase = Math.max(1, 5 - Math.floor(strong * 3)) + (closeLoss ? 3 : 0) + (roughMatch ? 1 : 0);
  const ourRobots = strong > .36 ? (index % 8 === 0 ? 1 : 2) : (index % 4 === 0 ? 1 : 0);
  const oppRobots = closeLoss || roughMatch ? 2 : (strong > .74 ? 0 : 1);
  const owned = ourColor;
  const notOwned = opponentColor;
  const seed = {
    daysAgo: daysAgoValue,
    teamAlliance,
    auton: strong > .68 ? ourColor : (roughMatch || closeLoss ? opponentColor : (index % 6 === 0 ? "tie" : "none")),
    redRobots: teamAlliance === "red" ? ourRobots : oppRobots,
    blueRobots: teamAlliance === "blue" ? ourRobots : oppRobots,
    topToggle: teamAlliance === "blue" ? owned : notOwned,
    rightToggle: teamAlliance === "blue" ? owned : (closeLoss ? notOwned : "neutral"),
    bottomToggle: teamAlliance === "red" ? owned : notOwned,
    leftToggle: teamAlliance === "red" ? owned : (closeLoss ? notOwned : "neutral"),
    topY: teamAlliance === "blue" ? Math.floor(strong * 4) : Math.floor(seededRandom(index + 1) * 2),
    topR: teamAlliance === "red" ? ourBase : Math.max(0, oppBase - 1),
    topB: teamAlliance === "blue" ? ourBase + Math.floor(strong * 2) : oppBase,
    rightY: teamAlliance === "blue" ? 1 + Math.floor(strong * 3) : Math.floor(seededRandom(index + 2) * 2),
    rightR: teamAlliance === "red" ? Math.max(0, ourBase - 1) : oppBase,
    rightB: teamAlliance === "blue" ? ourBase : Math.max(0, oppBase - 1),
    bottomY: teamAlliance === "red" ? 1 + Math.floor(strong * 3) : Math.floor(seededRandom(index + 3) * 2),
    bottomR: teamAlliance === "red" ? ourBase + Math.floor(strong * 2) : oppBase,
    bottomB: teamAlliance === "blue" ? Math.max(0, ourBase - 1) : Math.max(0, oppBase - 1),
    leftY: teamAlliance === "red" ? Math.floor(strong * 4) : Math.floor(seededRandom(index + 4) * 2),
    leftR: teamAlliance === "red" ? ourBase : Math.max(0, oppBase - 1),
    leftB: teamAlliance === "blue" ? Math.max(0, ourBase - 1) : oppBase,
    centerY: Math.floor(strong * 3),
    centerR: teamAlliance === "red" ? Math.floor(strong * 3) : Math.max(0, Math.floor((1 - strong) * 2)),
    centerB: teamAlliance === "blue" ? Math.floor(strong * 3) : Math.max(0, Math.floor((1 - strong) * 2)),
    partner: ["355V", "2055A", "169C", "1000A", "10K"][index % 5],
    opponentOne: ["169A", "32C", "96Z", "663A", "1468A"][index % 5],
    opponentTwo: ["227R", "10B", "471B", "886S", "1069A"][index % 5]
  };
  return seed;
}

function sampleSkillsSeed(index, total, skillsType) {
  const progress = total <= 1 ? 1 : index / (total - 1);
  const daysAgoValue = Math.round((1 - progress) * 96 + (skillsType === "autonomous" ? 1 : 0));
  const earlyMiss = index % 8 === 1 || index % 13 === 6;
  const lateClean = index > total * .68 && index % 5 !== 2;
  const route = Math.min(1, Math.max(0, progress + (lateClean ? .12 : 0) - (earlyMiss ? .25 : 0)));
  return {
    daysAgo: daysAgoValue,
    skillsType,
    centerToggle: route > .28,
    topToggle: route > .38 ? "blue" : "neutral",
    rightToggle: route > .58 ? "blue" : (route > .25 ? "neutral" : "red"),
    bottomToggle: route > .34 ? "red" : "neutral",
    leftToggle: route > .5 ? "red" : (route > .2 ? "neutral" : "blue"),
    topY: Math.floor(route * 3),
    topB: Math.floor(route * (skillsType === "driver" ? 5 : 3)),
    rightY: Math.floor(route * 3),
    rightB: Math.floor(route * (skillsType === "driver" ? 4 : 3)),
    bottomY: Math.floor(route * 3),
    bottomR: Math.floor(route * (skillsType === "driver" ? 5 : 3)),
    leftY: Math.floor(route * 3),
    leftR: Math.floor(route * (skillsType === "driver" ? 4 : 2)),
    centerY: Math.floor(route * 2),
    centerR: Math.floor(route * (skillsType === "driver" ? 2 : 1)),
    centerB: Math.floor(route * (skillsType === "driver" ? 2 : 1)),
    notes: route > .72
      ? `${skillsType === "driver" ? "Driver" : "Autonomous"} route is getting cleaner.`
      : `${skillsType === "driver" ? "Driver" : "Autonomous"} sample while tuning route.`
  };
}

function createSampleHeadRecord(seed) {
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
    id: `dev-head-${savedAt.getTime()}-${Math.random().toString(16).slice(2)}`,
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

function createSampleSkillsRecord(seed) {
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
      top: { yellow: seed.topY, red: 0, blue: seed.topB },
      right: { yellow: seed.rightY, red: 0, blue: seed.rightB },
      bottom: { yellow: seed.bottomY, red: seed.bottomR, blue: 0 },
      left: { yellow: seed.leftY, red: seed.leftR, blue: 0 },
      center: { yellow: seed.centerY, red: seed.centerR, blue: seed.centerB }
    }
  };

  return {
    id: `dev-skills-${savedAt.getTime()}-${Math.random().toString(16).slice(2)}`,
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

function seedSampleData() {
  const headSeeds = Array.from({ length: 72 }, (_, index) => sampleHeadSeed(index, 72));
  const skillsSeeds = [
    ...Array.from({ length: 40 }, (_, index) => sampleSkillsSeed(index, 40, "driver")),
    ...Array.from({ length: 34 }, (_, index) => sampleSkillsSeed(index, 34, "autonomous"))
  ];

  const nextMatches = [
    ...savedMatches().filter(record => !String(record.id || "").startsWith("dev-")),
    ...headSeeds.map(createSampleHeadRecord),
    ...skillsSeeds.map(createSampleSkillsRecord)
  ];
  writeSavedMatches(nextMatches);
  renderHistory();
  renderSkillsHistory();
  renderAnalysis();
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
  if (!profile) {
    openSetupModal();
  }
}

function setMode(mode) {
  activeMode = ["head", "skills", "scouting", "analysis"].includes(mode) ? mode : "head";
  renderMode();
}

function renderMode() {
  $$("[data-mode-choice]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.modeChoice === activeMode));
  });

  $$("[data-mode-section]").forEach((section) => {
    const isActive = section.dataset.modeSection === activeMode;
    section.hidden = !isActive;
    section.classList.toggle("is-active-mode-section", isActive);
  });
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
    <details class="analysis-correlation-lab">
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

function headCoachCards(matches) {
  const stats = analysisScoreStats(matches, match => match.ourScore);
  const wins = matches.filter(match => match.result === "win").length;
  const winRate = matches.length ? (wins / matches.length) * 100 : null;
  const yellowPlaced = matches.reduce((total, match) => total + yellowPins(match), 0);
  const yellowScored = matches.reduce((total, match) => total + numericValue(ownedYellowPins(match)), 0);
  const yellowRate = yellowPlaced ? (yellowScored / yellowPlaced) * 100 : null;
  const autonWinRate = matches.length ? (matches.filter(autonWon).length / matches.length) * 100 : null;
  const centerRate = matches.length ? (matches.filter(centerControlledByUs).length / matches.length) * 100 : null;
  const missedAverage = resultAverage(matches, match => missedHeadPoints(match).total);
  const recentDelta = Number.isFinite(stats.recentMean) && Number.isFinite(stats.mean) ? stats.recentMean - stats.mean : null;

  const working = Number.isFinite(recentDelta) && recentDelta >= 3
    ? t("analysis.headWorkingRecent", { count: stats.recentCount, delta: formatAnalysisNumber(recentDelta) })
    : Number.isFinite(winRate) && winRate >= 60
      ? t("analysis.headWorkingWinRate", { rate: formatAnalysisNumber(winRate, "%") })
      : t("analysis.headWorkingBaseline", { average: formatAnalysisNumber(stats.mean) });

  const costing = Number.isFinite(yellowRate) && yellowRate < 70
    ? t("analysis.headCostingYellows", { scored: yellowScored, placed: yellowPlaced })
    : Number.isFinite(autonWinRate) && autonWinRate < 45
      ? t("analysis.headCostingAuton", { rate: formatAnalysisNumber(autonWinRate, "%") })
      : t("analysis.headCostingMissed", { missed: formatAnalysisNumber(missedAverage) });

  const focus = Number.isFinite(centerRate) && centerRate < 55
    ? t("analysis.headFocusCenter")
    : Number.isFinite(yellowRate) && yellowRate < 85
      ? t("analysis.headFocusYellows")
      : t("analysis.headFocusBlueprint");

  return [
    analysisInsightCard(t("analysis.working"), working, Number.isFinite(recentDelta) ? `${recentDelta >= 0 ? "+" : ""}${formatAnalysisNumber(recentDelta)}` : `${formatAnalysisNumber(winRate, "%")}`, "analysis-coach-card"),
    analysisInsightCard(t("analysis.costing"), costing, Number.isFinite(missedAverage) ? t("analysis.avgValue", { value: formatAnalysisNumber(missedAverage) }) : t("analysis.checkDetails"), "analysis-coach-card"),
    analysisInsightCard(t("analysis.focus"), focus, t("analysis.nextPractice"), "analysis-coach-card")
  ].join("");
}

function headCoachNote(matches) {
  const stats = analysisScoreStats(matches, match => match.ourScore);
  const missedAverage = resultAverage(matches, match => missedHeadPoints(match).total);
  const delta = Number.isFinite(stats.recentMean) && Number.isFinite(stats.mean) ? stats.recentMean - stats.mean : null;
  if (Number.isFinite(delta) && delta > 2) {
    return t("analysis.headNoteUp", { delta: formatAnalysisNumber(delta), missed: formatAnalysisNumber(missedAverage) });
  }
  if (Number.isFinite(delta) && delta < -2) {
    return t("analysis.headNoteDown", { count: stats.recentCount });
  }
  return t("analysis.headNoteSteady", { average: formatAnalysisNumber(stats.mean) });
}

function renderHeadBreakdown(matches, allMatches) {
  return `
    ${analysisSectionTitle(t("analysis.headQuestion"), t("analysis.headQuestionDetail"))}
    <div class="analysis-insights">
      ${renderWinFactors(matches)}
      ${renderHeadMissedPoints(matches)}
      ${renderAutonReliability(matches)}
      ${renderCenterImpact(matches)}
      ${renderYellowEfficiency(matches)}
      ${renderFloorCeiling(matches, match => match.ourScore, t("analysis.badGoodRange"))}
      ${renderProgressCard(allMatches, match => match.ourScore, t("analysis.weeklyProgress"))}
      ${renderBestMatchBlueprint(matches)}
    </div>
  `;
}

function skillsCoachCards(runs) {
  const stats = analysisScoreStats(runs, run => run.score);
  const driverScores = scoreGetterValues(runs.filter(run => run.skillsType === "driver"), run => run.score);
  const autonScores = scoreGetterValues(runs.filter(run => run.skillsType === "autonomous"), run => run.score);
  const bestDriver = driverScores.length ? Math.max(...driverScores) : null;
  const bestAuton = autonScores.length ? Math.max(...autonScores) : null;
  const missed = runs.reduce((total, run) => total + skillsMissedYellowPins(run), 0);
  const placed = runs.reduce((total, run) => total + skillsYellowPins(run), 0);
  const recentDelta = Number.isFinite(stats.recentMean) && Number.isFinite(stats.mean) ? stats.recentMean - stats.mean : null;

  const working = Number.isFinite(recentDelta) && recentDelta >= 3
    ? t("analysis.skillsWorkingRecent", { count: stats.recentCount, delta: formatAnalysisNumber(recentDelta) })
    : t("analysis.skillsWorkingCombined", {
      combined: formatAnalysisNumber((bestDriver || 0) + (bestAuton || 0)),
      driver: formatAnalysisNumber(bestDriver),
      auton: formatAnalysisNumber(bestAuton)
    });
  const costing = placed
    ? t("analysis.skillsCostingYellows", { missed, placed })
    : t("analysis.skillsCostingNoYellows");
  const focus = average(driverScores) >= average(autonScores)
    ? t("analysis.skillsFocusAuton")
    : t("analysis.skillsFocusDriver");

  return [
    analysisInsightCard(t("analysis.working"), working, Number.isFinite(recentDelta) ? `${recentDelta >= 0 ? "+" : ""}${formatAnalysisNumber(recentDelta)}` : t("analysis.routeBase"), "analysis-coach-card"),
    analysisInsightCard(t("analysis.costing"), costing, missed ? t("analysis.missedCount", { count: missed }) : t("analysis.learning"), "analysis-coach-card"),
    analysisInsightCard(t("analysis.focus"), focus, t("analysis.nextPractice"), "analysis-coach-card")
  ].join("");
}

function skillsCoachNote(runs) {
  const stats = analysisScoreStats(runs, run => run.score);
  const driverAverage = resultAverage(runs.filter(run => run.skillsType === "driver"), run => run.score);
  const autonAverage = resultAverage(runs.filter(run => run.skillsType === "autonomous"), run => run.score);
  if (Number.isFinite(driverAverage) && Number.isFinite(autonAverage)) {
    return t("analysis.skillsNoteSplit", {
      average: formatAnalysisNumber(stats.mean),
      driver: formatAnalysisNumber(driverAverage),
      auton: formatAnalysisNumber(autonAverage)
    });
  }
  return t("analysis.skillsNoteOneType", { average: formatAnalysisNumber(stats.mean) });
}

function renderSkillsBreakdown(runs, allRuns) {
  return `
    ${analysisSectionTitle(t("analysis.skillsSourceQuestion"), t("analysis.skillsSourceDetail"))}
    <div class="analysis-insights">
      ${renderSkillsInsights(runs, allRuns)}
    </div>
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

  const width = 360;
  const height = 92;
  const pad = 12;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 1);
  const step = points.length === 1 ? 0 : (width - pad * 2) / (points.length - 1);
  const coordinates = points.map((score, index) => {
    const x = pad + index * step;
    const y = height - pad - ((score - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const dots = points.map((score, index) => {
    const x = pad + index * step;
    const y = height - pad - ((score - min) / range) * (height - pad * 2);
    const key = entries[index].record.mode === "skills" ? "run" : "match";
    const date = formatMatchDate(entries[index].record);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"><title>${escapeHtml(t(`analysis.pointTitle.${key}`, { index: index + 1, score: formatAnalysisNumber(score), date }))}</title></circle>`;
  }).join("");

  return `
    <div class="analysis-chart-wrap">
      <div class="analysis-chart-labels">
        <span>${escapeHtml(t("analysis.low", { value: formatAnalysisNumber(min) }))}</span>
        <span>${escapeHtml(t("analysis.high", { value: formatAnalysisNumber(max) }))}</span>
      </div>
      <svg class="analysis-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(t("analysis.scoreTrend"))}">
        <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" />
        <polyline points="${coordinates}" />
        ${dots}
      </svg>
      <div class="analysis-chart-labels">
        <span>${escapeHtml(t("analysis.oldest", { value: formatAnalysisNumber(points[0]) }))}</span>
        <span>${escapeHtml(t("analysis.newest", { value: formatAnalysisNumber(points[points.length - 1]) }))}</span>
      </div>
    </div>
  `;
}

function renderTrend(records, scoreGetter) {
  return `
    <div class="analysis-trend-head">
      <span>${escapeHtml(t("analysis.trendTitle"))}</span>
      <small>${escapeHtml(t(records.some(record => record.mode === "skills") ? "analysis.trendDetail.run" : "analysis.trendDetail.match"))}</small>
    </div>
    ${sparklineSvg(records, scoreGetter)}
  `;
}

function renderHeadAnalysis(allMatches, matches) {
  const summary = $("[data-analysis-head-summary]");
  const count = $("[data-analysis-head-count]");
  const coachWrap = $("[data-analysis-head-coach]");
  const statsWrap = $("[data-analysis-head-stats]");
  const trendWrap = $("[data-analysis-head-trend]");
  const breakdownWrap = $("[data-analysis-head-breakdown]");
  const correlationWrap = $("[data-analysis-head-correlation]");
  const insightsWrap = $("[data-analysis-head-insights]");
  if (!summary || !count || !coachWrap || !statsWrap || !trendWrap || !breakdownWrap || !correlationWrap || !insightsWrap) return;

  count.textContent = countText("analysis.matches", matches.length);
  if (!allMatches.length) {
    summary.textContent = t("analysis.head.emptySummary");
    coachWrap.innerHTML = "";
    insightsWrap.innerHTML = "";
    statsWrap.innerHTML = `<p class="analysis-empty">${escapeHtml(t("analysis.head.emptyPanel"))}</p>`;
    trendWrap.innerHTML = "";
    breakdownWrap.innerHTML = "";
    correlationWrap.innerHTML = "";
    return;
  }

  if (!matches.length) {
    summary.textContent = t("analysis.noRange");
    coachWrap.innerHTML = "";
    insightsWrap.innerHTML = "";
    statsWrap.innerHTML = `<p class="analysis-empty">${escapeHtml(t("analysis.noRange"))}</p>`;
    trendWrap.innerHTML = "";
    breakdownWrap.innerHTML = "";
    correlationWrap.innerHTML = "";
    return;
  }

  const stats = analysisScoreStats(matches, match => match.ourScore);
  const wins = matches.filter(match => match.result === "win").length;
  const losses = matches.filter(match => match.result === "loss").length;
  const ties = matches.filter(match => match.result === "tie").length;
  const winRate = matches.length ? (wins / matches.length) * 100 : null;

  summary.textContent = t("analysis.summaryAverage", { score: formatAnalysisNumber(stats.mean) });
  coachWrap.innerHTML = analysisCoachNote(headCoachNote(matches));
  insightsWrap.innerHTML = headCoachCards(matches);
  statsWrap.innerHTML = [
    analysisStat(t("analysis.averageScore"), formatAnalysisNumber(stats.mean)),
    analysisStat(t("analysis.winRate"), formatAnalysisNumber(winRate, "%"), t("analysis.recordDetail", { wins, losses, ties })),
    analysisStat(t("analysis.best"), formatAnalysisNumber(stats.best)),
    analysisStat(t("analysis.median"), formatAnalysisNumber(stats.median)),
    analysisStat(t("analysis.worst"), formatAnalysisNumber(stats.worst)),
    analysisStat(t("analysis.last5"), formatAnalysisNumber(stats.recentMean), recentFormDetail(stats))
  ].join("");
  trendWrap.innerHTML = renderTrend(matches, match => match.ourScore);
  breakdownWrap.innerHTML = renderHeadBreakdown(matches, allMatches);
  correlationWrap.innerHTML = renderCorrelation(matches, headCorrelationOptions, headCorrelationX, headCorrelationY, "head");
}

function renderSkillsAnalysis(allRuns, runs) {
  const summary = $("[data-analysis-skills-summary]");
  const count = $("[data-analysis-skills-count]");
  const coachWrap = $("[data-analysis-skills-coach]");
  const statsWrap = $("[data-analysis-skills-stats]");
  const splitWrap = $("[data-analysis-skills-split]");
  const trendWrap = $("[data-analysis-skills-trend]");
  const correlationWrap = $("[data-analysis-skills-correlation]");
  const insightsWrap = $("[data-analysis-skills-insights]");
  if (!summary || !count || !coachWrap || !statsWrap || !splitWrap || !trendWrap || !correlationWrap || !insightsWrap) return;

  count.textContent = countText("analysis.runs", runs.length);
  if (!allRuns.length) {
    summary.textContent = t("analysis.skills.emptySummary");
    coachWrap.innerHTML = "";
    insightsWrap.innerHTML = "";
    statsWrap.innerHTML = `<p class="analysis-empty">${escapeHtml(t("analysis.skills.emptyPanel"))}</p>`;
    splitWrap.innerHTML = "";
    trendWrap.innerHTML = "";
    correlationWrap.innerHTML = "";
    return;
  }

  if (!runs.length) {
    summary.textContent = t("analysis.noRange");
    coachWrap.innerHTML = "";
    insightsWrap.innerHTML = "";
    statsWrap.innerHTML = `<p class="analysis-empty">${escapeHtml(t("analysis.noRange"))}</p>`;
    splitWrap.innerHTML = "";
    trendWrap.innerHTML = "";
    correlationWrap.innerHTML = "";
    return;
  }

  const stats = analysisScoreStats(runs, run => run.score);
  const driverScores = runs
    .filter(run => run.skillsType === "driver")
    .map(run => numericValue(run.score))
    .filter(value => Number.isFinite(value));
  const autonScores = runs
    .filter(run => run.skillsType === "autonomous")
    .map(run => numericValue(run.score))
    .filter(value => Number.isFinite(value));
  const bestDriver = driverScores.length ? Math.max(...driverScores) : null;
  const bestAuton = autonScores.length ? Math.max(...autonScores) : null;
  const theoretical = Number.isFinite(bestDriver) || Number.isFinite(bestAuton)
    ? (bestDriver || 0) + (bestAuton || 0)
    : null;

  summary.textContent = t("analysis.summaryAverage", { score: formatAnalysisNumber(stats.mean) });
  coachWrap.innerHTML = analysisCoachNote(skillsCoachNote(runs));
  insightsWrap.innerHTML = skillsCoachCards(runs);
  statsWrap.innerHTML = [
    analysisStat(t("analysis.averageScore"), formatAnalysisNumber(stats.mean)),
    analysisStat(t("analysis.best"), formatAnalysisNumber(stats.best)),
    analysisStat(t("analysis.median"), formatAnalysisNumber(stats.median)),
    analysisStat(t("analysis.worst"), formatAnalysisNumber(stats.worst)),
    analysisStat(t("analysis.last5"), formatAnalysisNumber(stats.recentMean), recentFormDetail(stats))
  ].join("");
  splitWrap.innerHTML = `
    ${analysisSectionTitle(t("analysis.skillsQuestion"), t("analysis.skillsQuestionDetail"))}
    <div class="analysis-trend-head analysis-subhead">
      <span>${escapeHtml(t("analysis.skillsSplit"))}</span>
      <small>${escapeHtml(t("analysis.skillsSplitDetail"))}</small>
    </div>
    <div class="analysis-stats analysis-stats-tight">
      ${analysisStat(t("analysis.driverAvg"), formatAnalysisNumber(average(driverScores)))}
      ${analysisStat(t("analysis.autonAvg"), formatAnalysisNumber(average(autonScores)))}
      ${analysisStat(t("analysis.bestDriver"), formatAnalysisNumber(bestDriver))}
      ${analysisStat(t("analysis.bestAuton"), formatAnalysisNumber(bestAuton))}
      ${analysisStat(t("analysis.bestCombined"), formatAnalysisNumber(theoretical))}
    </div>
  `;
  trendWrap.innerHTML = renderTrend(runs, run => run.score);
  correlationWrap.innerHTML = renderCorrelation(runs, skillsCorrelationOptions, skillsCorrelationX, skillsCorrelationY, "skills");
  splitWrap.insertAdjacentHTML("beforeend", renderSkillsBreakdown(runs, allRuns));
}

function renderAnalysis() {
  renderAnalysisMode();
  renderAnalysisRange();
  const headMatches = sortedHeadMatches();
  const skillsRuns = sortedSkillsRuns();
  renderHeadAnalysis(headMatches, filterAnalysisRecords(headMatches));
  renderSkillsAnalysis(skillsRuns, filterAnalysisRecords(skillsRuns));
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

applyI18n();
buildCounters();
renderMode();
render();
renderSkills();
renderHistory();
renderSkillsHistory();
renderAnalysis();
renderImportedCompetition();
ensureSyncedEventsLoaded();
initializeProfileGate();
