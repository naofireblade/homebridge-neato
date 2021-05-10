export enum CleanType {
  ALL,
  SPOT,
}

export enum RobotService {
  CLEAN = "clean",
  CLEAN_SPOT = "cleanSpot",
  CLEAN_ZONE = "cleanZone",
  GO_TO_DOCK = "goToDock",
  DOCKED = "dockState",
  BIN_FULL = "binFull",
  FIND_ME = "findMe",
  SCHEDULE = "schedule",
  ECO = "eco",
  NOGO_LINES = "noGoLines",
  EXTRA_CARE = "extraCare",
  BATTERY = "battery",
}
