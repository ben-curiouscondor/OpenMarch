import FieldProperties from "./FieldProperties";
import Marcher from "./Marcher";
import MarcherPage from "./MarcherPage";
import Page from "./Page";

const INCHES_PER_YARD = 36;

export interface MinMaxStepSizes {
    min: StepSize | undefined;
    max: StepSize | undefined;
}

export class StepSize {
    /* ----------- Attributes ----------- */

    /** Steps needed to cover five yards, for example 8 for 8 to 5 */
    readonly stepsPerFiveYards: number;
    /** Id of the marcher for this step size */
    readonly marcher_id: number;

    constructor({
        marcher_id,
        startingX,
        startingY,
        endingX,
        endingY,
        counts,
        fieldProperties,
    }: {
        marcher_id: number;
        startingX: number;
        startingY: number;
        endingX: number;
        endingY: number;
        counts: number;
        fieldProperties: FieldProperties;
    }) {
        this.marcher_id = marcher_id;
        this.stepsPerFiveYards = StepSize.calculateStepSize({
            startingX,
            startingY,
            endingX,
            endingY,
            counts,
            pixelsPerStep: fieldProperties.pixelsPerStep,
        });
    }

    private static calculateStepSize({
        startingX,
        startingY,
        endingX,
        endingY,
        counts,
        pixelsPerStep,
    }: {
        startingX: number;
        startingY: number;
        endingX: number;
        endingY: number;
        counts: number;
        pixelsPerStep: number;
    }) {
        if (!counts) {
            return NaN; // don't divide by 0, indicate there is no actual number here
        }

        // find the horizontal distance across the canvas
        const xDistance = Math.abs(endingX - startingX);
        // find the vertical distance across the canvas
        const yDistance = Math.abs(endingY - startingY);
        // pythagorean theorem to get the total distance
        const distanceInPixels = Math.sqrt(xDistance ** 2 + yDistance ** 2);

        if (!distanceInPixels) {
            return Infinity; // don't divide by 0, indicates a hold
        }

        // convert to distance in 8 to 5 steps
        const distanceIn8to5Steps = distanceInPixels / pixelsPerStep;
        // convert to distance in inches
        const distanceCoveredInInches = distanceIn8to5Steps * 22.5;
        // determine the distance in inches per step
        const distanceInInchesPerStep = distanceCoveredInInches / counts;

        // determine how many steps it would take to traverse 5 yards and round the result
        return (INCHES_PER_YARD * 5) / distanceInInchesPerStep;
    }

    /**
     * Creates a display string for the step size, e.g. "8 to 5" or "6.7 to 5"
     * @returns display string
     */
    displayString() {
        if (Number.isNaN(this.stepsPerFiveYards)) {
            return "Undefined"; // when there are 0 counts in the page.
        }

        if (this.stepsPerFiveYards === Infinity) {
            return "Hold"; // when the performer hasn't moved at all from the previous page.
        }

        const roundedSteps = Math.round(this.stepsPerFiveYards * 10) / 10;
        if (roundedSteps > 64) {
            return "Tiny"; // show 'Tiny' instead of something crazy like 73,249.7 to 5
        }

        return `${roundedSteps.toLocaleString()} to 5`;
    }

    /**
     * Creates a step size object from a starting and ending marcher page, and the drill page.
     *
     * @param startingPage starting coordinate of the move
     * @param endingPage ending page of the move
     * @param page represents the move, including number of counts
     * @param fieldProperties The properties of the performance area
     * @returns optional StepSize, if defined
     */
    static createStepSizeForMarcher({
        startingPage,
        endingPage,
        page,
        fieldProperties,
    }: {
        startingPage?: MarcherPage;
        endingPage: MarcherPage;
        page?: Page;
        fieldProperties: FieldProperties;
    }) {
        if (!startingPage || !page) {
            return undefined;
        }

        return new StepSize({
            marcher_id: endingPage.marcher_id,
            startingX: startingPage.x,
            startingY: startingPage.y,
            endingX: endingPage.x,
            endingY: endingPage.y,
            counts: page.counts,
            fieldProperties,
        });
    }

    /**
     * Returns a list of step sizes for the given marchers
     * @param startingPages the starting coordinates of each marcher
     * @param endingPages the ending coordinates of each marcher
     * @param page the page that the marchers are on
     * @param fieldProperties the properties of the performance area
     * @returns step size for all given marchers
     */
    static createStepSizesForMarchers({
        marchers,
        marcherPages,
        page,
        fieldProperties,
    }: {
        marchers: Marcher[];
        marcherPages: MarcherPage[];
        page: Page;
        fieldProperties: FieldProperties;
    }) {
        const startingPages = marcherPages.filter(
            (marcherPage) => marcherPage.page_id === page.id - 1,
        );
        const endingPages = marcherPages.filter(
            (marcherPage) => marcherPage.page_id === page.id,
        );
        return marchers
            .map((marcher) => {
                const startingPage = startingPages.find(
                    (marcherPage) => marcherPage.marcher_id === marcher.id,
                );
                const endingPage = endingPages.find(
                    (marcherPage) => marcherPage.marcher_id === marcher.id,
                );
                if (!endingPage) return undefined;

                return StepSize.createStepSizeForMarcher({
                    startingPage,
                    endingPage,
                    page: page,
                    fieldProperties,
                });
            })
            .filter((stepSize) => stepSize !== undefined); // filter out undefined
    }

    /**
     * Returns the smallest and largest step size for the given marchers
     * @param startingPages the starting coordinates of each marcher
     * @param endingPages the ending coordinates of each marcher
     * @param page the page that the marchers are on
     * @param fieldProperties the properties of the performance area
     * @returns largest and smallest step size for the given marchers
     */
    static getMinAndMaxStepSizesForMarchers({
        marchers,
        marcherPages,
        page,
        fieldProperties,
    }: {
        marchers: Marcher[];
        marcherPages: MarcherPage[];
        page: Page;
        fieldProperties: FieldProperties;
    }) {
        const stepSizes = StepSize.createStepSizesForMarchers({
            marchers,
            marcherPages,
            page,
            fieldProperties,
        }).sort((o1, o2) => StepSize.compare(o1, o2)); // sort by smallest to largest step size

        if (!stepSizes.length) {
            return {
                min: undefined,
                max: undefined,
            };
        }

        return {
            min: stepSizes[0],
            max: stepSizes[stepSizes.length - 1],
        };
    }

    /**
     * Compares two step sizes by their steps per five yards. Considers step size to be larger if it is less steps per five yards.
     * @param a first step size
     * @param b second step size
     * @returns > 1 if first is larger, < 1 if second is larger, 0 if equal
     */
    static compare(a: StepSize, b: StepSize) {
        // Smaller number means larger step size
        return b.stepsPerFiveYards - a.stepsPerFiveYards;
    }
}