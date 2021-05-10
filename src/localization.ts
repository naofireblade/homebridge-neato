export enum availableLocales {
    EN = "en",
    DE = "de",
    FR = "fr",
}

const localizationDicts = {
    'en': {
        "clean": "Clean",
        "cleanZone": "Clean Zone",
        "cleanThe": "Clean the",
        "goToDock": "Go to Dock",
        "dockState": "Docked",
        "binFull": "Bin Full",
        "eco": "Eco Mode",
        "noGoLines": "NoGo Lines",
        "extraCare": "Extra Care",
        "schedule": "Schedule",
        "findMe": "Find me",
        "cleanSpot": "Clean Spot",
        "battery": "Battery"
    },
    'de': {
        "clean": "Saugen",
        "cleanZone": "Sauge Zone",
        "cleanThe": "Sauge",
        "goToDock": "Zur Basis",
        "dockState": "In der Basis",
        "binFull": "Behälter voll",
        "eco": "Eco Modus",
        "noGoLines": "NoGo Linien",
        "extraCare": "Extra Vorsicht",
        "schedule": "Zeitplan",
        "findMe": "Finde mich",
        "cleanSpot": "Sauge Bereich",
        "battery": "Batterie"
    },
    'fr': {
        "clean": "Aspirer",
        "cleanZone": "Aspirer Zone",
        "cleanThe": "Aspirer",
        "goToDock": "Retour à la base",
        "dockState": "Sur la base",
        "binFull": "Conteneur plein",
        "eco": "Eco mode",
        "noGoLines": "Lignes NoGo",
        "extraCare": "Extra Care",
        "schedule": "Planifier",
        "findMe": "Me retrouver",
        "cleanSpot": "Nettoyage local",
        "battery": "Batterie"
    }
}

export function localize(label: string, locale: availableLocales) : string {
    return localizationDicts[locale][label] ?? label
}