/**
 * A beat unit is a fraction of a whole note that represents the duration of a note.
 * This is used for things like tempo and pulse.
 */
class BeatUnit {
    readonly value: number;
    readonly name: string;

    private constructor(value: number, name: string) {
        this.value = value;
        this.name = name;
    }

    // The following are the beat units that are available
    static WHOLE = new BeatUnit(1, "WHOLE");
    static HALF = new BeatUnit(1 / 2, "HALF");
    static DOTTED_HALF = new BeatUnit(3 / 4, "DOTTED HALF");
    static QUARTER = new BeatUnit(1 / 4, "QUARTER");
    static DOTTED_QUARTER = new BeatUnit(3 / 8, "DOTTED QUARTER");
    static EIGHTH = new BeatUnit(1 / 8, "EIGHTH");
    static DOTTED_EIGHTH = new BeatUnit(3 / 16, "DOTTED EIGHTH");
    static SIXTEENTH = new BeatUnit(1 / 16, "16TH");
    static DOTTED_SIXTEENTH = new BeatUnit(3 / 32, "DOTTED 16TH");
    static THIRTY_SECOND = new BeatUnit(1 / 32, "32ND");
    static SIXTY_FOURTH = new BeatUnit(1 / 64, "64TH");

    /**
     * Returns the string representation of the beat unit.
     */
    toString() {
        return this.name;
    }

    /**
     * @param other The other beat unit to compare to.
     * @returns True if the other beat unit is equal to this beat unit.
     */
    equals(other: BeatUnit): boolean {
        return this.value === other.value && this.name === other.name;
    }

    /**
     * Returns the beat unit from the string representation.
     * @param name The name of the beat unit.
     */
    static fromString(name: string): BeatUnit {
        switch (name) {
            case "WHOLE": return BeatUnit.WHOLE;
            case "HALF": return BeatUnit.HALF;
            case "DOTTED HALF": return BeatUnit.DOTTED_HALF;
            case "QUARTER": return BeatUnit.QUARTER;
            case "DOTTED QUARTER": return BeatUnit.DOTTED_QUARTER;
            case "EIGHTH": return BeatUnit.EIGHTH;
            case "DOTTED EIGHTH": return BeatUnit.DOTTED_EIGHTH;
            case "16TH": return BeatUnit.SIXTEENTH;
            case "DOTTED 16TH": return BeatUnit.DOTTED_SIXTEENTH;
            case "32ND": return BeatUnit.THIRTY_SECOND;
            case "64TH": return BeatUnit.SIXTY_FOURTH;
            default: throw new Error(`Invalid beat unit name: ${name}`);
        }
    }
}

export default BeatUnit;
