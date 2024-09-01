import { cleanup } from "@testing-library/react";
import { describe, expect, afterEach, it, vi } from "vitest";
import OpenMarchCanvas from "../OpenMarchCanvas";
import { FieldProperties } from "@/global/classes/FieldProperties";
import { UiSettings } from "@/global/Interfaces";
import { mockMarcherPages, mockMarchers, mockPages } from "./MocksForCanvas";
import MarcherPage from "@/global/classes/MarcherPage";

describe("OpenMarchCanvas", () => {
    const falseyUiSettings: UiSettings = {
        isPlaying: false,
        lockX: false,
        lockY: false,
        previousPaths: false,
        nextPaths: false,
    };

    afterEach(() => {
        vi.clearAllMocks();
        cleanup();
    });

    describe("renderMarchers", () => {
        it("Canvas renders and contains marchers in the correct position", () => {
            const NCAAFieldProperties = new FieldProperties(
                FieldProperties.Template.NCAA
            );
            const canvas = new OpenMarchCanvas(
                null,
                NCAAFieldProperties,
                falseyUiSettings
            );
            const selectedPage = mockPages[0];
            canvas.renderMarchers({
                allMarchers: mockMarchers,
                selectedMarcherPages: MarcherPage.filterByPageId(
                    mockMarcherPages,
                    selectedPage.id
                ),
            });
            const canvasMarchers = canvas.getCanvasMarchers();
            // expect(canvasMarchers.length).toBe(mockMarchers.length);
            for (const marcher of mockMarchers) {
                const canvasMarcher = canvasMarchers.find(
                    (canvasMarcher) =>
                        canvasMarcher.marcherObj.id === marcher.id
                );
                expect(canvasMarcher).toBeDefined();
                if (!canvasMarcher) return;
                const marcherPage = mockMarcherPages.find(
                    (marcherPage) =>
                        marcherPage.marcher_id === marcher.id &&
                        marcherPage.page_id === selectedPage.id
                );
                expect(marcherPage).toBeDefined();
                if (!marcherPage) return;
                const canvasMarcherCoords = canvasMarcher.getMarcherCoords();
                expect(canvasMarcherCoords.x).toBe(marcherPage.x);
                expect(canvasMarcherCoords.y).toBe(marcherPage.y);
            }
        });
    });

    describe("refreshMarchers", () => {
        it.todo(
            "Leaves the canvasMarchers alone on refresh when unchanged",
            () => {}
        );
        it.todo(
            "Restores the canvasMarchers to their original position on refresh when changed",
            () => {}
        );
    });
});
