import { useFieldProperties } from "@/context/fieldPropertiesContext";
import { useSelectedMarchers } from "@/context/SelectedMarchersContext";
import { useSelectedPage } from "@/context/SelectedPageContext";
import { useMarcherPageStore } from "@/stores/marcherPage/useMarcherPageStore";
import { usePageStore } from "@/stores/page/usePageStore";
import { useUiSettingsStore } from "@/stores/uiSettings/useUiSettingsStore";
import { useCallback, useEffect, useRef } from "react";
import { getRoundCoordinates } from "./CoordinateActions";
import { MarcherPage } from "@/global/classes/MarcherPage";
import { Page } from "@/global/classes/Page";
import { useIsPlaying } from "@/context/IsPlayingContext";
import { useRegisteredActionsStore } from "@/stores/registeredAction/useRegisteredActionsStore";

/**
 * A RegisteredAction is a uniform object to represent a function in OpenMarch.
 * RegisteredActions can be triggered by a keyboard shortcut or by registering
 * a button ref to the RegisteredActionsStore.
 *
 * Use the getRegisteredAction function to get the RegisteredAction object for a given action.
 */
class RegisteredAction {
    /** The KeyboardShortcut to trigger the action */
    readonly keyboardShortcut?: KeyboardShortcut;
    /** The description of the action. Also used for the instructional string
     * E.g. "Lock the X axis" */
    readonly desc: string;
    /** The string to display in the UI for the keyboard shortcut. Eg. "Snap to nearest whole [Shift + X]" */
    readonly instructionalString: string;
    /** Instructional string to toggle on the given action (only relevant for toggle-based actions)
     * E.g. "Enable X axis [Shift + X]" */
    readonly instructionalStringToggleOn: string;
    /** Instructional string to toggle off the given action (only relevant for toggle-based actions)
     * E.g. "Lock X axis [Shift + X]" */
    readonly instructionalStringToggleOff: string;

    /**
     *
     * @param keyboardShortcut The keyboard shortcut to trigger the action. Optional.
     * @param desc The description of the action. Also used for the instructional string. "Lock the X axis"
     * @param toggleOnStr The string to display in the UI for the keyboard shortcut when the action is toggled on. Defaults to the desc
     * @param toggleOffStr The string to display in the UI for the keyboard shortcut when the action is toggled off. Defaults to the desc
     */
    constructor({ keyboardShortcut, desc, toggleOnStr, toggleOffStr }:
        { keyboardShortcut?: KeyboardShortcut; desc: string; action?: () => any; toggleOnStr?: string; toggleOffStr?: string; }) {

        this.keyboardShortcut = keyboardShortcut;
        this.desc = desc;
        const keyString = keyboardShortcut ? ` [${keyboardShortcut.toString()}]` : "";
        this.instructionalString = this.desc + keyString;
        this.instructionalStringToggleOn = toggleOnStr ? (toggleOnStr + keyString) : this.instructionalString;
        this.instructionalStringToggleOff = toggleOffStr ? (toggleOffStr + keyString) : this.instructionalString;
    }
}

/**
 * A KeyboardShortcut is a combination of a key and modifiers that can trigger an action.
 */
class KeyboardShortcut {
    /** The key to press to trigger the action (not case sensitive). E.g. "q" */
    readonly key: string;
    /** True if the control key needs to be held down (Command in macOS)*/
    readonly control: boolean;
    /** True if the alt key needs to be held down (option in macOS) */
    readonly alt: boolean;
    /** True if the shift key needs to be held down */
    readonly shift: boolean;

    constructor({ key, control = false, alt = false, shift = false }:
        { key: string; control?: boolean; alt?: boolean; shift?: boolean; }) {
        this.key = key.toLowerCase();
        this.control = control;
        this.alt = alt;
        this.shift = shift;
    }

    /**
     * Returns a string representation of the key and modifiers.
     * @returns The string representation of the key and modifiers. E.g. "Ctrl + Shift + Q"
     */
    toString() {
        const keyStr = this.key === " " ? "Space" : this.key.toUpperCase();
        return `${this.control ? "Ctrl + " : ""}${this.alt ? "Alt + " : ""}${this.shift ? "Shift + " : ""}${keyStr}`
    }

    /**
     * Returns true if the shortcut's keys are equal. (including control, alt, and shift keys)
     * @param action The action to compare
     * @returns True if the shortcut's keys are equal
     */
    equal(action: KeyboardShortcut) {
        return this.key === action.key
            && this.control === action.control
            && this.alt === action.alt
            && this.shift === action.shift;
    }
}

/**
 * The interface for the registered actions. This exists so it is easy to see what actions are available.
 */
export enum RegisteredActionsEnum {
    // Navigation and playback
    nextPage = "nextPage",
    lastPage = "lastPage",
    previousPage = "previousPage",
    firstPage = "firstPage",
    playPause = "playPause",

    // Batch editing
    setAllMarchersToPreviousPage = "setAllMarchersToPreviousPage",
    setSelectedMarcherToPreviousPage = "setSelectedMarcherToPreviousPage",

    // Alignment
    snapToNearestWhole = "snapToNearestWhole",
    lockX = "lockX",
    lockY = "lockY",

    // UI settings
    toggleNextPagePaths = "toggleNextPagePaths",
    togglePreviousPagePaths = "togglePreviousPagePaths",
}

/**
 * Details for all the registered actions.
 * This is useful for getting the details of a registered action at compile time.
 */
export const RegisteredActionsObjects: { [key in RegisteredActionsEnum]: RegisteredAction } = {
    // Navigation and playback
    nextPage: new RegisteredAction({
        desc: "Next page",
        keyboardShortcut: new KeyboardShortcut({ key: "e" })
    }),
    lastPage: new RegisteredAction({
        desc: "Last page",
        keyboardShortcut: new KeyboardShortcut({ key: "e", shift: true })
    }),
    previousPage: new RegisteredAction({
        desc: "Previous page",
        keyboardShortcut: new KeyboardShortcut({ key: "q" })
    }),
    firstPage: new RegisteredAction({
        desc: "First page",
        keyboardShortcut: new KeyboardShortcut({ key: "q", shift: true })
    }),
    playPause: new RegisteredAction({
        desc: "Play or pause", toggleOnStr: "Play", toggleOffStr: "Pause",
        keyboardShortcut: new KeyboardShortcut({ key: " " })
    }),

    // Batch editing
    setAllMarchersToPreviousPage: new RegisteredAction({
        desc: "Set all marcher coordinates to previous page",
        keyboardShortcut: new KeyboardShortcut({ key: "p", shift: true, control: true })
    }),
    setSelectedMarcherToPreviousPage: new RegisteredAction({
        desc: "Set selected marcher coordinates to previous page",
        keyboardShortcut: new KeyboardShortcut({ key: "p", shift: true })
    }),

    // Alignment
    snapToNearestWhole: new RegisteredAction({
        desc: "Snap to nearest whole",
        keyboardShortcut: new KeyboardShortcut({ key: "1" })
    }),
    lockX: new RegisteredAction({
        desc: "Lock X axis", toggleOnStr: "Lock X movement", toggleOffStr: "Enable X movement",
        keyboardShortcut: new KeyboardShortcut({ key: "z" })
    }),
    lockY: new RegisteredAction({
        desc: "Lock Y axis", toggleOnStr: "Lock Y movement", toggleOffStr: "Enable Y movement",
        keyboardShortcut: new KeyboardShortcut({ key: "x" })
    }),

    // UI settings
    togglePreviousPagePaths: new RegisteredAction({
        desc: "Toggle viewing previous page paths",
        toggleOnStr: "Show previous page dots/paths", toggleOffStr: "Hide previous page dots/paths",
        keyboardShortcut: new KeyboardShortcut({ key: "n" })
    }),
    toggleNextPagePaths: new RegisteredAction({
        desc: "Toggle viewing next page paths",
        toggleOnStr: "Show next page dots/paths", toggleOffStr: "Hide next page dots/paths",
        keyboardShortcut: new KeyboardShortcut({ key: "m" })
    }),
} as const;

/**
 * The RegisteredActionsHandler is a component that listens for keyboard shortcuts and button clicks to trigger actions.
 * It is responsible for handling the actions and triggering the appropriate functions.
 *
 * All actions in OpenMarch that can be a keyboard shortcut or a button click should be registered here.
 */
function RegisteredActionsHandler() {
    const { registeredButtonActions } = useRegisteredActionsStore()!;
    const { pages } = usePageStore()!;
    const { isPlaying, setIsPlaying } = useIsPlaying()!;
    const { marcherPages } = useMarcherPageStore()!;
    const { selectedPage, setSelectedPage } = useSelectedPage()!;
    const { selectedMarchers } = useSelectedMarchers()!;
    const { fieldProperties } = useFieldProperties()!;
    const { uiSettings, setUiSettings } = useUiSettingsStore()!;

    const keyboardShortcutDictionary = useRef<{ [shortcutKeyString: string]: RegisteredActionsEnum }>({});

    /**
     * Get the MarcherPages for the selected marchers on the selected page.
     */
    const getSelectedMarcherPages = useCallback(() => {
        if (!selectedPage) {
            console.error('No selected page');
            return [];
        }
        // Get the marcherPages for the selected Page to make searching faster
        const selectedPageMarcherPages: MarcherPage[] = marcherPages.filter(marcherPage => marcherPage.page_id === selectedPage.id);

        const selectedMarcherPages: MarcherPage[] = []
        selectedMarchers.forEach(marcher => {
            selectedMarcherPages.push(selectedPageMarcherPages.find(marcherPage => marcherPage.marcher_id === marcher.id)!);
        })
        return selectedMarcherPages;
    }, [marcherPages, selectedMarchers, selectedPage]);

    /**
     * Trigger a RegisteredAction.
     */
    const triggerAction = useCallback((action: RegisteredActionsEnum) => {
        if (!selectedPage) {
            console.error('No selected page');
            return;
        }
        if (!fieldProperties) {
            console.error('No field properties');
            return;
        }
        const registeredActionObject = RegisteredActionsObjects[action];
        switch (action) {
            /****************** Navigation and playback ******************/
            case RegisteredActionsEnum.nextPage: {
                const nextPage = Page.getNextPage(selectedPage, pages);
                if (nextPage) setSelectedPage(nextPage);
                break;
            }
            case RegisteredActionsEnum.lastPage: {
                const lastPage = Page.getLastPage(pages);
                if (lastPage) setSelectedPage(lastPage);
                break;
            }
            case RegisteredActionsEnum.previousPage: {
                const previousPage = Page.getPreviousPage(selectedPage, pages);
                if (previousPage) setSelectedPage(previousPage);
                break;
            }
            case RegisteredActionsEnum.firstPage: {
                const firstPage = Page.getFirstPage(pages);
                if (firstPage) setSelectedPage(firstPage);
                break;
            }
            case RegisteredActionsEnum.playPause:
                setIsPlaying(!isPlaying);
                break;

            /****************** Alignment ******************/
            case RegisteredActionsEnum.setAllMarchersToPreviousPage: {
                const previousPage = Page.getPreviousPage(selectedPage, pages);
                const previousPageMarcherPages = marcherPages.filter(marcherPage => marcherPage.page_id === previousPage?.id);
                const changes = previousPageMarcherPages.map(marcherPage => ({ ...marcherPage, page_id: selectedPage.id }));
                MarcherPage.updateMarcherPages(changes);
                break;
            }
            case RegisteredActionsEnum.setSelectedMarcherToPreviousPage: {
                const previousPage = Page.getPreviousPage(selectedPage, pages);
                const previousMarcherPage = marcherPages.find(
                    marcherPage => marcherPage.page_id === previousPage?.id
                        && marcherPage.marcher_id === selectedMarchers[0].id
                );
                if (previousMarcherPage) {
                    MarcherPage.updateMarcherPages([{ ...previousMarcherPage, page_id: selectedPage.id }]);
                }
                break;
            }

            /****************** Alignment ******************/
            case RegisteredActionsEnum.snapToNearestWhole: {
                const roundedCoords = getRoundCoordinates({
                    marcherPages: getSelectedMarcherPages(), fieldProperites: fieldProperties, denominator: 1,
                    xAxis: !uiSettings.lockX, yAxis: !uiSettings.lockY
                });
                MarcherPage.updateMarcherPages(roundedCoords);
                break;
            }
            case RegisteredActionsEnum.lockX:
                setUiSettings({ ...uiSettings, lockX: !uiSettings.lockX }, 'lockX');
                break;
            case RegisteredActionsEnum.lockY:
                setUiSettings({ ...uiSettings, lockY: !uiSettings.lockY }, 'lockY');
                break;

            /****************** UI settings ******************/
            case RegisteredActionsEnum.toggleNextPagePaths:
                setUiSettings({ ...uiSettings, nextPaths: !uiSettings.nextPaths });
                break;
            case RegisteredActionsEnum.togglePreviousPagePaths:
                setUiSettings({ ...uiSettings, previousPaths: !uiSettings.previousPaths });
                break;
            default:
                console.error(`No action registered for "${registeredActionObject.instructionalString}"`);
                return;
        }
    }, [fieldProperties, getSelectedMarcherPages, isPlaying, marcherPages, pages, selectedMarchers, selectedPage,
        setIsPlaying, setSelectedPage, setUiSettings, uiSettings]);

    /**
     * Create a dictionary of keyboard shortcuts to actions. This is used to trigger actions from keyboard shortcuts.
     */
    useEffect(() => {
        keyboardShortcutDictionary.current = Object.fromEntries(
            Object.values(RegisteredActionsEnum).map(
                (action) => [RegisteredActionsObjects[action].keyboardShortcut?.toString() || "",
                    action]
            )
        );
    }, []);

    /**
     * Handles the keyboard shortcuts for entire react side of the application.
     */
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!document.activeElement?.matches("input, textarea, select, [contenteditable]")) {
            const keyboardAction = new KeyboardShortcut(
                { key: e.key, control: e.ctrlKey || e.metaKey, alt: e.altKey, shift: e.shiftKey });
            const keyString = keyboardAction.toString();
            if (keyboardShortcutDictionary.current[keyString]) {
                triggerAction(keyboardShortcutDictionary.current[keyString]);
                e.preventDefault();
            }
        }
    }, [triggerAction]);

    /**
     * register the keyboard listener to the window to listen for keyboard shortcuts.
     */
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    /**
     * Register the button refs for the keyboard shortcuts
     */
    useEffect(() => {
        registeredButtonActions.forEach(buttonAction => {
            if (!buttonAction.buttonRef.current) {
                console.error(`No button ref for ${buttonAction.registeredAction}`);
                return;
            }
            buttonAction.buttonRef.current.onclick = () => triggerAction(buttonAction.registeredAction);
        })
    }, [registeredButtonActions, triggerAction]);

    return <></> // empty fragment
}

export default RegisteredActionsHandler;