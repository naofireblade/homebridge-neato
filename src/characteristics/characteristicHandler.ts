import { Characteristic, CharacteristicGetHandler, CharacteristicSetHandler, WithUUID } from "homebridge";

export declare interface CharacteristicHandler{
    characteristic: WithUUID<new () => Characteristic>
    getCharacteristicHandler?: CharacteristicGetHandler, 
    setCharacteristicHandler?: CharacteristicSetHandler
}