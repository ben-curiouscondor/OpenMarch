import { fabric } from "fabric";
import CanvasMarcher from "./CanvasMarcher";
import StaticCanvasMarcher from "./StaticCanvasMarcher";
import { Pathway } from "./Pathway";
import {
    FieldProperties,
    getYardNumberCoordinates,
} from "@/global/classes/FieldProperties";
import CanvasListeners from "./listeners/CanvasListeners";
import Marcher from "@/global/classes/Marcher";
import { IGroupOptions } from "fabric/fabric-impl";
import { UiSettings } from "@/global/Interfaces";
import MarcherPage from "@/global/classes/MarcherPage";
import Page from "@/global/classes/Page";

/**
 * A custom class to extend the fabric.js canvas for OpenMarch.
 */
export default class OpenMarchCanvas extends fabric.Canvas {
    /** The drag start time is used to determine if the mouse was clicked or dragged */
    readonly DRAG_TIMER_MILLISECONDS = 300;
    /** The distance threshold is used to determine if the mouse was clicked or dragged */
    readonly DISTANCE_THRESHOLD = 20;

    /** Denotes whether the Canvas itself is being dragged by the user to pan the view */
    isDragging = false;
    /** The point where the user's mouse was when they started dragging the canvas. This is used to adjust the viewport transform. */
    panDragStartPos: { x: number; y: number } = { x: 0, y: 0 };
    /** The time and the position of the user's mouse when selecting a fabric object */
    selectDragStart: { x: number; y: number; time: number } = {
        x: 0,
        y: 0,
        time: 0,
    };
    /** The timeout for when object caching should be re-enabled */
    private zoomTimeout: NodeJS.Timeout | undefined;

    private _uiSettings: UiSettings;

    // TODO - not sure what either of these are for. I had them on the Canvas in commit 4023b18
    perfLimitSizeTotal = 225000000;
    maxCacheSideLimit = 11000;

    // STATE FUNCTIONS
    // These must be set by a react component that uses this canvas
    private _undefinedStateFunction = (name: string) => {
        console.error(
            `State function not set: ${name}. The canvas will not work as expected`
        );
    };
    /** Renders all marchers on the canvas. Must be updated with current state */
    // renderMarchers: () => void = () =>
    //     this._undefinedStateFunction("renderMarchers");

    /**
     * The reference to the grid (the lines on the field) object to use for caching
     * This is needed to disable object caching while zooming, which greatly improves responsiveness.
     */
    staticGridRef: fabric.Group;

    constructor(
        canvasRef: HTMLCanvasElement | null,
        fieldProperties: FieldProperties,
        uiSettings: UiSettings
    ) {
        super(canvasRef, {
            // TODO - why are these here from 4023b18
            // selectionColor: "white",
            // selectionLineWidth: 8,
            selectionColor: "rgba(0, 0, 255, 0.2)",
            selectionBorderColor: "rgba(0, 0, 255, 1)",
            selectionLineWidth: 2,
        });

        // Set canvas size
        this.refreshCanvasSize();
        // Update canvas size on window resize
        window.addEventListener("resize", (evt) => {
            this.refreshCanvasSize();
        });

        // create the grid
        this.staticGridRef = OpenMarchCanvas.createFieldGrid({
            fieldProperties,
        });
        // Object caching is set to true to make the grid sharper
        this.staticGridRef.objectCaching = true;
        // add the grid to the canvas
        this.add(this.staticGridRef);

        // The mouse wheel event should never be changed
        this.on("mouse:wheel", this.handleMouseWheel);

        // Set the UI settings
        this._uiSettings = uiSettings;

        this.renderAll();
    }

    /******************* INSTANCE METHODS ******************/
    /**
     * Refreshes the size of the canvas to fit the window.
     */
    refreshCanvasSize() {
        this.setWidth(window.innerWidth);
        this.setHeight(window.innerHeight);
    }

    /**
     * Set the listeners on the canvas. This should be changed based on the cursor mode.
     *
     * @param listeners The listeners to set on the canvas
     * @param clearListeners Whether or not to clear the listeners before setting the new ones. Default is true
     */
    setListeners(listeners: CanvasListeners, clearListeners = true) {
        clearListeners && this.clearListeners();

        this.on("object:modified", listeners.handleObjectModified);
        // this.on("selection:updated", listeners.handleSelect);
        // this.on("selection:created", listeners.handleSelect);
        // this.on("selection:cleared", listeners.handleDeselect);

        // this.on("mouse:down", listeners.handleMouseDown);
        // this.on("mouse:move", listeners.handleMouseMove);
        // this.on("mouse:up", listeners.handleMouseUp);
    }

    /**
     * Clear all listeners on the canvas
     */
    clearListeners() {
        this.off("object:modified");
        // this.off("selection:updated");
        // this.off("selection:created");
        // this.off("selection:cleared");

        // this.off("mouse:down");
        // this.off("mouse:move");
        // this.off("mouse:up");
    }

    /**
     * Set the given CanvasMarchers as the selected marchers both in the app and on the Canvas
     *
     * @param selectedObjects The CanvasMarchers to set as selected (can pass any fabric.Object, they are filtered)
     */
    setSelectedCanvasMarchers = ({
        selectedObjects,
        setSelectedMarchers,
        uiSettings,
        allMarchers,
    }: {
        selectedObjects: fabric.Object[];
        setSelectedMarchers: (newSelectedMarchers: Marcher[]) => void;
        uiSettings: UiSettings;
        allMarchers: Marcher[];
    }) => {
        // console.log("selectLock", handleSelectLock.current);
        // if (handleSelectLock.current) return;
        // When multiple marchers are selected, mark as them as the active object
        // This is how the view of the most current active marcher is maintained
        // handleSelectLock.current = true;
        console.log("CANVAS", this);
        if (selectedObjects.length > 1) {
            // The current active object needs to be discarded before creating a new active selection
            // This is due to buggy behavior in Fabric.js
            this.discardActiveObject();
            const selectedCanvasMarchers =
                this.getActiveObjectsByType(CanvasMarcher);

            const activeSelection = new fabric.ActiveSelection(
                selectedCanvasMarchers,
                {
                    canvas: this,
                    ...ActiveObjectArgs,
                }
            );

            this.setActiveObject(activeSelection);
            this.requestRenderAll();
        }

        const activeObject = this.getActiveObject();

        // Apply the lock settings to the active object
        if (activeObject) {
            activeObject.lockMovementX = uiSettings.lockX;
            activeObject.lockMovementY = uiSettings.lockY;
        }

        const activeMarcherIds = this.getActiveObjectsByType(CanvasMarcher).map(
            (activeObject) => activeObject.marcherObj.id
        );
        console.log("ACTIVE MARCHER IDS", activeMarcherIds);
        const newSelectedMarchers = allMarchers.filter((marcher) =>
            activeMarcherIds.includes(marcher.id)
        );
        setSelectedMarchers(newSelectedMarchers);
    };

    /******* Marcher Functions *******/
    /**
     * Render the marchers for the current page
     *
     * @param selectedMarcherPages The marcher pages to render (must be filtered by the selected page)
     * @param allMarchers All marchers in the drill
     */
    renderMarchers = ({
        selectedMarcherPages,
        allMarchers,
    }: {
        selectedMarcherPages: MarcherPage[];
        allMarchers: Marcher[];
    }) => {
        // Get the canvas marchers on the canvas
        const curCanvasMarchers: CanvasMarcher[] = this.getCanvasMarchers();

        selectedMarcherPages.forEach((marcherPage) => {
            const curCanvasMarcher = curCanvasMarchers.find(
                (canvasMarcher) =>
                    canvasMarcher.marcherObj.id === marcherPage.marcher_id
            );
            // Marcher does not exist on the Canvas, create a new one
            if (!curCanvasMarcher) {
                const curMarcher = allMarchers.find(
                    (marcher) => marcher.id === marcherPage.marcher_id
                );
                if (!curMarcher) {
                    console.error(
                        "Marcher object not found in the store for given MarcherPage  - renderMarchers: Canvas.tsx",
                        marcherPage
                    );
                    return;
                }

                this.add(
                    new CanvasMarcher({ marcher: curMarcher, marcherPage })
                );
            }
            // Marcher exists on the Canvas, move it to the new location if it has changed
            else {
                curCanvasMarcher.setMarcherCoords(marcherPage);
            }
        });

        this.requestRenderAll();
    };

    /**
     * Brings all of the canvasMarchers to the front of the canvas
     */
    sendCanvasMarchersToFront = () => {
        // Get the canvas marchers on the canvas
        const curCanvasMarchers: CanvasMarcher[] = this.getCanvasMarchers();

        curCanvasMarchers.forEach((canvasMarcher) => {
            this.bringToFront(canvasMarcher);
        });
    };

    /**
     * Render static marchers for the given page
     *
     * @param color The color of the static marchers (use rgba for transparency, e.g. "rgba(255, 255, 255, 1)")
     * @param intendedMarcherPages The marcher pages to render (must be filtered by the given page)
     * @param allMarchers All marchers in the drill
     */
    renderStaticMarchers = ({
        color,
        intendedMarcherPages,
        allMarchers,
    }: {
        color: string;
        intendedMarcherPages: MarcherPage[];
        allMarchers: Marcher[];
    }) => {
        intendedMarcherPages.forEach((marcherPage) => {
            const curMarcher = allMarchers.find(
                (marcher) => marcher.id === marcherPage.marcher_id
            );
            if (!curMarcher) {
                console.error(
                    "Marcher object not found in the store for given MarcherPage - renderStaticMarchers: Canvas.tsx",
                    marcherPage
                );
                return;
            }

            const staticMarcher = new StaticCanvasMarcher({
                marcher: curMarcher,
                marcherPage,
                color,
            });

            this.add(staticMarcher);
        });
        this.requestRenderAll();
    };

    /**
     * Remove the static canvas marchers from the canvas
     */
    removeStaticCanvasMarchers = () => {
        const curStaticCanvasMarchers = this.getStaticCanvasMarchers();

        curStaticCanvasMarchers.forEach((canvasMarcher) => {
            this.remove(canvasMarcher);
        });
        this.requestRenderAll();
    };

    /**
     * Render the pathways from the selected page to the given one
     *
     * @param startPageMarcherPages the marcher pages to render the pathway from
     * @param endPageMarcherPages the marcher pages to render the pathway to
     * @param color color of the pathway
     */
    renderPathways = ({
        startPageMarcherPages,
        endPageMarcherPages,
        color,
    }: {
        startPageMarcherPages: MarcherPage[];
        endPageMarcherPages: MarcherPage[];
        color: string;
    }) => {
        endPageMarcherPages.forEach((previousMarcherPage) => {
            const selectedMarcherPage = startPageMarcherPages.find(
                (marcherPage) =>
                    marcherPage.marcher_id === previousMarcherPage.marcher_id
            );
            // If the marcher does not exist on the selected page, return
            if (!selectedMarcherPage) {
                console.error(
                    "Selected marcher page not found - renderPathways: Canvas.tsx",
                    previousMarcherPage
                );
                return;
            }

            const pathway = new Pathway({
                start: previousMarcherPage,
                end: selectedMarcherPage,
                color,
            });

            this.add(pathway);
        });
        this.requestRenderAll();
    };

    removePathways = () => {
        const curPathways: Pathway[] = this.getPathways();

        curPathways.forEach((pathway) => {
            this.remove(pathway);
        });

        this.requestRenderAll();
    };

    /*********************** PRIVATE INSTANCE METHODS ***********************/
    /**
     * Zoom in and out with the mouse wheel
     */
    private handleMouseWheel = (fabricEvent: fabric.IEvent<WheelEvent>) => {
        // set objectCaching to true to improve performance while zooming
        if (!this.staticGridRef.objectCaching)
            this.staticGridRef.objectCaching = true;

        // set objectCaching to true to improve performance while zooming
        if (!this.staticGridRef.objectCaching)
            this.staticGridRef.objectCaching = true;

        const delta = fabricEvent.e.deltaY;
        let zoom = this.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 25) zoom = 25;
        if (zoom < 0.35) zoom = 0.35;
        this.zoomToPoint(
            { x: fabricEvent.e.offsetX, y: fabricEvent.e.offsetY },
            zoom
        );
        fabricEvent.e.preventDefault();
        fabricEvent.e.stopPropagation();

        // set objectCaching to false after 100ms to improve performance after zooming
        // This is why the grid is blurry but fast while zooming, and sharp while not.
        // If it was always sharp (object caching on), it would be horrendously slow
        clearTimeout(this.zoomTimeout);
        this.zoomTimeout = setTimeout(() => {
            if (this.staticGridRef.objectCaching) {
                this.staticGridRef.objectCaching = false;
                this.renderAll();
            }
        }, 50);
    };

    /*********************** GETTERS ***********************/

    public get uiSettings() {
        return this._uiSettings;
    }

    /**
     * Gets all objects of a specified type in the canvas.
     * Mostly used as a utility function, but can be called on its own.
     *
     * @param type The type of object to get (must be a subclass of fabric.Object)
     * @returns A list of objects of the specified type in the canvas
     */
    getObjectsByType<T extends fabric.Object>(
        type: new (...args: any[]) => T
    ): T[] {
        return this.getObjects().filter((obj) => obj instanceof type) as T[];
    }

    /**
     * Gets all active (selected) objects of a specified type in the canvas.
     * Mostly used as a utility function, but can be called on its own.
     *
     * @param type The type of object to get (must be a subclass of fabric.Object)
     * @returns A list of active (selected) objects of the specified type in the canvas
     */
    getActiveObjectsByType<T extends fabric.Object>(
        type: new (...args: any[]) => T
    ): T[] {
        return this.getActiveObjects().filter(
            (obj) => obj instanceof type
        ) as T[];
    }

    /**
     * @param active true if you only want to return active (selected) objects. By default, false
     * @returns A list of all CanvasMarcher objects in the canvas
     */
    getCanvasMarchers({
        active = false,
    }: { active?: boolean } = {}): CanvasMarcher[] {
        return active
            ? this.getActiveObjectsByType(CanvasMarcher)
            : this.getObjectsByType(CanvasMarcher);
    }

    /**
     * @param active true if you only want to return active (selected) objects. By default, false
     * @returns A list of all StaticCanvasMarcher objects in the canvas
     */
    getStaticCanvasMarchers({
        active = false,
    }: { active?: boolean } = {}): StaticCanvasMarcher[] {
        return active
            ? this.getActiveObjectsByType(StaticCanvasMarcher)
            : this.getObjectsByType(StaticCanvasMarcher);
    }

    /**
     * @param active true if you only want to return active (selected) objects. By default, false
     * @returns A list of all Pathway objects in the canvas
     */
    getPathways({ active = false }: { active?: boolean } = {}): Pathway[] {
        return active
            ? this.getActiveObjectsByType(Pathway)
            : this.getObjectsByType(Pathway);
    }

    /*********************** SETTERS ***********************/
    /** set the UI settings and make all of the changes in this canvas that correspond to it */
    public set uiSettings(uiSettings: UiSettings) {
        this._uiSettings = uiSettings;
    }

    /*********************** PRIVATE STATIC METHODS ***********************/
    /**
     * Builds the grid for the field/stage based on the given field properties as a fabric.Group.
     *
     * @param fieldProperties Field properties to build the field from
     * @param gridLines Whether or not to include grid lines (every step)
     * @param halfLines Whether or not to include half lines (every 4 steps)
     * @returns
     */
    private static createFieldGrid = ({
        fieldProperties,
        gridLines = true,
        halfLines = true,
    }: {
        fieldProperties: FieldProperties;
        gridLines?: boolean;
        halfLines?: boolean;
    }): fabric.Group => {
        const fieldArray: fabric.Object[] = [];
        const fieldWidth = fieldProperties.width;
        const fieldHeight = fieldProperties.height;
        const pixelsPerStep = FieldProperties.PIXELS_PER_STEP;
        const centerFrontPoint = fieldProperties.centerFrontPoint;

        // white background
        const background = new fabric.Rect({
            left: 0,
            top: 0,
            width: fieldWidth,
            height: fieldHeight,
            fill: "white",
            selectable: false,
            hoverCursor: "default",
        });
        fieldArray.push(background);

        // Grid lines
        if (gridLines) {
            const gridLineProps = {
                stroke: "#DDDDDD",
                strokeWidth: FieldProperties.GRID_STROKE_WIDTH,
                selectable: false,
            };
            // X
            for (
                let i = centerFrontPoint.xPixels + pixelsPerStep;
                i < fieldWidth;
                i += pixelsPerStep
            )
                fieldArray.push(
                    new fabric.Line([i, 0, i, fieldHeight], gridLineProps)
                );
            for (
                let i = centerFrontPoint.xPixels - pixelsPerStep;
                i > 0;
                i -= pixelsPerStep
            )
                fieldArray.push(
                    new fabric.Line([i, 0, i, fieldHeight], gridLineProps)
                );

            // Y
            for (
                let i = centerFrontPoint.yPixels - pixelsPerStep;
                i > 0;
                i -= pixelsPerStep
            )
                fieldArray.push(
                    new fabric.Line([0, i, fieldWidth, i], gridLineProps)
                );
        }

        // Half lines
        if (halfLines) {
            const darkLineProps = {
                stroke: "#AAAAAA",
                strokeWidth: FieldProperties.GRID_STROKE_WIDTH,
                selectable: false,
            };
            // X
            for (
                let i = centerFrontPoint.xPixels + pixelsPerStep * 4;
                i < fieldWidth;
                i += pixelsPerStep * 8
            )
                fieldArray.push(
                    new fabric.Line([i, 0, i, fieldHeight], darkLineProps)
                );
            for (
                let i = centerFrontPoint.xPixels - pixelsPerStep * 4;
                i > 0;
                i -= pixelsPerStep * 8
            )
                fieldArray.push(
                    new fabric.Line([i, 0, i, fieldHeight], darkLineProps)
                );

            // Y
            for (
                let i = centerFrontPoint.yPixels - pixelsPerStep * 4;
                i > 0;
                i -= pixelsPerStep * 4
            )
                fieldArray.push(
                    new fabric.Line([0, i, fieldWidth, i], darkLineProps)
                );
        }

        // Yard lines, field numbers, and hashes
        const xCheckpointProps = {
            stroke: "black",
            strokeWidth: FieldProperties.GRID_STROKE_WIDTH,
            selectable: false,
        };
        const yCheckpointProps = {
            stroke: "black",
            strokeWidth: FieldProperties.GRID_STROKE_WIDTH * 3,
            selectable: false,
        };
        const ySecondaryCheckpointProps = {
            stroke: "gray",
            strokeWidth: FieldProperties.GRID_STROKE_WIDTH * 2,
            selectable: false,
        };
        const yardNumberCoordinates = getYardNumberCoordinates(
            fieldProperties.template
        );
        const numberHeight =
            (yardNumberCoordinates.homeStepsFromFrontToInside -
                yardNumberCoordinates.homeStepsFromFrontToOutside) *
            pixelsPerStep;
        const numberProps = {
            fontSize: numberHeight,
            fill: "#888888",
            selectable: false,
            charSpacing: 160,
        };
        const yardNumberXOffset = 18;
        fieldProperties.xCheckpoints.forEach((xCheckpoint) => {
            // Yard line
            const x =
                centerFrontPoint.xPixels +
                xCheckpoint.stepsFromCenterFront * pixelsPerStep;
            fieldArray.push(
                new fabric.Line([x, 0, x, fieldHeight], xCheckpointProps)
            );

            // Yard line numbers
            if (xCheckpoint.fieldLabel) {
                // Home number
                fieldArray.push(
                    new fabric.Text(xCheckpoint.fieldLabel, {
                        left: x - yardNumberXOffset,
                        top:
                            centerFrontPoint.yPixels -
                            yardNumberCoordinates.homeStepsFromFrontToInside *
                                pixelsPerStep,
                        ...numberProps,
                    })
                );
                // Away number
                fieldArray.push(
                    new fabric.Text(xCheckpoint.fieldLabel, {
                        left: x - yardNumberXOffset,
                        top:
                            centerFrontPoint.yPixels -
                            yardNumberCoordinates.awayStepsFromFrontToOutside *
                                pixelsPerStep,
                        flipY: true,
                        flipX: true,
                        ...numberProps,
                    })
                );
            }

            // Hashes
            const hashWidth = 20;
            fieldProperties.yCheckpoints.forEach((yCheckpoint) => {
                if (yCheckpoint.visible !== false) {
                    const y =
                        centerFrontPoint.yPixels +
                        yCheckpoint.stepsFromCenterFront * pixelsPerStep -
                        1;
                    let x1 = x - hashWidth / 2;
                    x1 = x1 < 0 ? 0 : x1;
                    let x2 = x + hashWidth / 2;
                    x2 = x2 > fieldWidth ? fieldWidth : x2;
                    fieldArray.push(
                        new fabric.Line(
                            [x1, y, x2 + 1, y],
                            yCheckpoint.useAsReference
                                ? yCheckpointProps
                                : ySecondaryCheckpointProps
                        )
                    );
                }
            });
        });

        // Border
        const borderWidth = FieldProperties.GRID_STROKE_WIDTH * 3;
        const borderOffset = 1 - borderWidth; // Offset to prevent clipping. Border hangs off the edge of the canvas
        const borderProps = {
            stroke: "black",
            strokeWidth: borderWidth,
            selectable: false,
        };
        // Back line
        fieldArray.push(
            new fabric.Line(
                [
                    borderOffset,
                    borderOffset,
                    fieldWidth - borderOffset,
                    borderOffset,
                ],
                borderProps
            )
        );
        // Front line
        fieldArray.push(
            new fabric.Line(
                [
                    borderOffset,
                    fieldHeight,
                    fieldWidth - borderOffset + 1,
                    fieldHeight,
                ],
                borderProps
            )
        );
        // Left line
        fieldArray.push(
            new fabric.Line(
                [
                    borderOffset,
                    borderOffset,
                    borderOffset,
                    fieldHeight - borderOffset,
                ],
                borderProps
            )
        );
        // Right line
        fieldArray.push(
            new fabric.Line(
                [
                    fieldWidth,
                    borderOffset,
                    fieldWidth,
                    fieldHeight - borderOffset,
                ],
                borderProps
            )
        );

        return new fabric.Group(fieldArray, {
            selectable: false,
            hoverCursor: "default",
        });
    };
}

/**
 * The colors for the canvas.
 */
export const CanvasColors = {
    previousPage: "rgba(0, 0, 0, 1)",
    nextPage: "rgba(0, 175, 13, 1)",
} as const;

/**
 * Options for the background image on the canvas.
 */
export const NoControls: IGroupOptions = {
    hasControls: false,
    hasBorders: false,
    lockMovementX: true,
    lockMovementY: true,
    lockRotation: true,
    selectable: false,
    hoverCursor: "default",
    evented: false,
} as const;

/**
 * Options for the active object on the canvas.
 * If this is changed here, it must also be changed in the handleSelect function in Canvas.tsx.
 */
export const ActiveObjectArgs: IGroupOptions = {
    hasControls: false,
    hasBorders: true,
    lockRotation: true,
    borderColor: "#0d6efd",
    borderScaleFactor: 2,
} as const;
