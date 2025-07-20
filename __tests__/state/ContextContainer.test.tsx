import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React, { useEffect, useState } from "react";
import { act, render, renderHook } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
    ContextContainer,
    type ContextContainerType,
    useViewability,
    useViewabilityAmount,
    useRecyclingEffect,
    useRecyclingState,
    useIsLastItem,
    useListScrollSize,
} from "../../src/state/ContextContainer";
import type { StateContext } from "../../src/state/state";
import type { ViewToken, ViewAmountToken, LegendListRecyclingState } from "../../src/types";

// Mock the state dependencies
const mockStateContext = {
    values: new Map(),
    listeners: new Map(),
    mapViewabilityCallbacks: new Map(),
    mapViewabilityValues: new Map(),
    mapViewabilityAmountCallbacks: new Map(),
    mapViewabilityAmountValues: new Map(),
    columnWrapperStyle: undefined,
    viewRefs: new Map(),
} as StateContext;

// Mock the state hooks
const mockUseStateContext = () => mockStateContext;
const mockUseSelector$ = (key: string, selector: (value: any) => any) => {
    const value = mockStateContext.values.get(key);
    return selector ? selector(value) : value;
};
const mockUseArr$ = (keys: string[]) => {
    return keys.map(key => mockStateContext.values.get(key));
};

// Mock all the state imports
jest.mock("../../src/state/state", () => ({
    useStateContext: () => mockStateContext,
    useSelector$: (key: string, selector: (value: any) => any) => {
        const value = mockStateContext.values.get(key);
        return selector ? selector(value) : value;
    },
    useArr$: (keys: string[]) => {
        return keys.map(key => mockStateContext.values.get(key));
    },
}));

// Mock useInit hook
jest.mock("../../src/hooks/useInit", () => ({
    useInit: (callback: () => void) => {
        useEffect(() => {
            callback();
        }, []);
    },
}));

// Mock helpers
jest.mock("../../src/utils/helpers", () => ({
    isFunction: (value: any) => typeof value === "function",
}));

// Helper to create a test wrapper with ContextContainer
function createContextWrapper(containerProps: ContextContainerType) {
    return function TestWrapper({ children }: { children: React.ReactNode }) {
        return (
            <ContextContainer.Provider value={containerProps}>
                {children}
            </ContextContainer.Provider>
        );
    };
}

describe("ContextContainer hooks", () => {
    let mockContainerContext: ContextContainerType;
    let triggerLayoutSpy: jest.Mock;

    beforeEach(() => {
        // Clear all maps
        mockStateContext.mapViewabilityCallbacks.clear();
        mockStateContext.mapViewabilityValues.clear();
        mockStateContext.mapViewabilityAmountCallbacks.clear();
        mockStateContext.mapViewabilityAmountValues.clear();
        mockStateContext.values.clear();

        triggerLayoutSpy = jest.fn();
        mockContainerContext = {
            containerId: 1,
            itemKey: "item-1",
            index: 0,
            value: { id: 1, text: "Item 1" },
            triggerLayout: triggerLayoutSpy,
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("useViewability", () => {
        it("should register callback in context", () => {
            const callback = jest.fn();
            const wrapper = createContextWrapper(mockContainerContext);

            renderHook(() => useViewability(callback), { wrapper });

            expect(mockStateContext.mapViewabilityCallbacks.has("1")).toBe(true);
            expect(mockStateContext.mapViewabilityCallbacks.get("1")).toBe(callback);
        });

        it("should use configId when provided", () => {
            const callback = jest.fn();
            const wrapper = createContextWrapper(mockContainerContext);

            renderHook(() => useViewability(callback, "config-1"), { wrapper });

            expect(mockStateContext.mapViewabilityCallbacks.has("1config-1")).toBe(true);
            expect(mockStateContext.mapViewabilityCallbacks.get("1config-1")).toBe(callback);
        });

        it("should call callback with existing value on init", () => {
            const callback = jest.fn();
            const viewToken: ViewToken = {
                containerId: 1,
                index: 0,
                isViewable: true,
                item: { id: 1 },
                key: "item-1",
            };

            mockStateContext.mapViewabilityValues.set("1", viewToken);

            const wrapper = createContextWrapper(mockContainerContext);
            renderHook(() => useViewability(callback), { wrapper });

            expect(callback).toHaveBeenCalledWith(viewToken);
        });

        it("should clean up callback on unmount", () => {
            const callback = jest.fn();
            const wrapper = createContextWrapper(mockContainerContext);

            const { unmount } = renderHook(() => useViewability(callback), { wrapper });

            expect(mockStateContext.mapViewabilityCallbacks.has("1")).toBe(true);

            unmount();

            expect(mockStateContext.mapViewabilityCallbacks.has("1")).toBe(false);
        });

        it("should handle multiple viewability configs", () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const wrapper = createContextWrapper(mockContainerContext);

            renderHook(() => useViewability(callback1, "config-1"), { wrapper });
            renderHook(() => useViewability(callback2, "config-2"), { wrapper });

            expect(mockStateContext.mapViewabilityCallbacks.has("1config-1")).toBe(true);
            expect(mockStateContext.mapViewabilityCallbacks.has("1config-2")).toBe(true);
            expect(mockStateContext.mapViewabilityCallbacks.get("1config-1")).toBe(callback1);
            expect(mockStateContext.mapViewabilityCallbacks.get("1config-2")).toBe(callback2);
        });
    });

    describe("useViewabilityAmount", () => {
        it("should register amount callback in context", () => {
            const callback = jest.fn();
            const wrapper = createContextWrapper(mockContainerContext);

            renderHook(() => useViewabilityAmount(callback), { wrapper });

            expect(mockStateContext.mapViewabilityAmountCallbacks.has(1)).toBe(true);
            expect(mockStateContext.mapViewabilityAmountCallbacks.get(1)).toBe(callback);
        });

        it("should call callback with existing amount value on init", () => {
            const callback = jest.fn();
            const amountToken: ViewAmountToken = {
                containerId: 1,
                index: 0,
                isViewable: true,
                item: { id: 1 },
                key: "item-1",
                percentOfScroller: 50,
                percentVisible: 75,
                scrollSize: 400,
                size: 100,
                sizeVisible: 75,
            };

            mockStateContext.mapViewabilityAmountValues.set(1, amountToken);

            const wrapper = createContextWrapper(mockContainerContext);
            renderHook(() => useViewabilityAmount(callback), { wrapper });

            expect(callback).toHaveBeenCalledWith(amountToken);
        });

        it("should clean up amount callback on unmount", () => {
            const callback = jest.fn();
            const wrapper = createContextWrapper(mockContainerContext);

            const { unmount } = renderHook(() => useViewabilityAmount(callback), { wrapper });

            expect(mockStateContext.mapViewabilityAmountCallbacks.has(1)).toBe(true);

            unmount();

            expect(mockStateContext.mapViewabilityAmountCallbacks.has(1)).toBe(false);
        });

        it("should handle no existing amount value gracefully", () => {
            const callback = jest.fn();
            const wrapper = createContextWrapper(mockContainerContext);

            renderHook(() => useViewabilityAmount(callback), { wrapper });

            expect(callback).not.toHaveBeenCalled();
            expect(mockStateContext.mapViewabilityAmountCallbacks.has(1)).toBe(true);
        });
    });

    describe("useRecyclingEffect", () => {
        it("should not call effect on first render", () => {
            const effect = jest.fn();
            const wrapper = createContextWrapper(mockContainerContext);

            renderHook(() => useRecyclingEffect(effect), { wrapper });

            expect(effect).not.toHaveBeenCalled();
        });

        it("should call effect on subsequent renders with previous values", () => {
            const effect = jest.fn();
            const wrapper = createContextWrapper(mockContainerContext);

            const { rerender } = renderHook(() => useRecyclingEffect(effect), { wrapper });

            // First render - no effect call
            expect(effect).not.toHaveBeenCalled();

            // Update context and rerender
            const newContext = {
                ...mockContainerContext,
                index: 1,
                value: { id: 2, text: "Item 2" },
            };

            rerender();

            expect(effect).toHaveBeenCalledWith({
                index: 0,
                item: { id: 1, text: "Item 1" },
                prevIndex: undefined,
                prevItem: undefined,
            });
        });

        it("should handle effect cleanup function", () => {
            const cleanup = jest.fn();
            const effect = jest.fn(() => cleanup);
            const wrapper = createContextWrapper(mockContainerContext);

            const { unmount, rerender } = renderHook(() => useRecyclingEffect(effect), { wrapper });

            // Trigger effect
            rerender();

            unmount();

            expect(cleanup).toHaveBeenCalled();
        });

        it("should track value changes correctly", () => {
            const effect = jest.fn();
            let currentContext = { ...mockContainerContext };

            function TestComponent() {
                useRecyclingEffect(effect);
                return null;
            }

            const { rerender } = render(
                <ContextContainer.Provider value={currentContext}>
                    <TestComponent />
                </ContextContainer.Provider>
            );

            // Update to new values
            currentContext = {
                ...currentContext,
                index: 1,
                value: { id: 2, text: "Item 2" },
            };

            rerender(
                <ContextContainer.Provider value={currentContext}>
                    <TestComponent />
                </ContextContainer.Provider>
            );

            expect(effect).toHaveBeenCalledWith({
                index: 1,
                item: { id: 2, text: "Item 2" },
                prevIndex: 0,
                prevItem: { id: 1, text: "Item 1" },
            });
        });
    });

    describe("useRecyclingState", () => {
        it("should initialize with static value", () => {
            const wrapper = createContextWrapper(mockContainerContext);

            const { result } = renderHook(() => useRecyclingState("initial"), { wrapper });

            expect(result.current[0]).toBe("initial");
        });

        it("should initialize with function value", () => {
            const initializer = jest.fn(({ item }: LegendListRecyclingState<any>) => `processed-${item.id}`);
            const wrapper = createContextWrapper(mockContainerContext);

            const { result } = renderHook(() => useRecyclingState(initializer), { wrapper });

            expect(initializer).toHaveBeenCalledWith({
                index: 0,
                item: { id: 1, text: "Item 1" },
                prevIndex: undefined,
                prevItem: undefined,
            });
            expect(result.current[0]).toBe("processed-1");
        });

        it("should reset state when itemKey changes", () => {
            const initializer = jest.fn(({ item }: LegendListRecyclingState<any>) => `processed-${item.id}`);
            let currentContext = { ...mockContainerContext };

            function TestComponent() {
                const [value] = useRecyclingState(initializer);
                return <div data-testid="value">{value}</div>;
            }

            const { rerender, getByTestId } = render(
                <ContextContainer.Provider value={currentContext}>
                    <TestComponent />
                </ContextContainer.Provider>
            );

            expect(getByTestId("value")).toHaveTextContent("processed-1");
            expect(initializer).toHaveBeenCalledTimes(1);

            // Change itemKey to trigger reset
            currentContext = {
                ...currentContext,
                itemKey: "item-2",
                index: 1,
                value: { id: 2, text: "Item 2" },
            };

            rerender(
                <ContextContainer.Provider value={currentContext}>
                    <TestComponent />
                </ContextContainer.Provider>
            );

            expect(getByTestId("value")).toHaveTextContent("processed-2");
            expect(initializer).toHaveBeenCalledTimes(2);
        });

        it("should update state via setState", () => {
            const wrapper = createContextWrapper(mockContainerContext);

            const { result } = renderHook(() => useRecyclingState("initial"), { wrapper });

            expect(result.current[0]).toBe("initial");

            act(() => {
                result.current[1]("updated");
            });

            expect(result.current[0]).toBe("updated");
            expect(triggerLayoutSpy).toHaveBeenCalled();
        });

        it("should update state via function setState", () => {
            const wrapper = createContextWrapper(mockContainerContext);

            const { result } = renderHook(() => useRecyclingState(10), { wrapper });

            expect(result.current[0]).toBe(10);

            act(() => {
                result.current[1]((prev) => prev + 5);
            });

            expect(result.current[0]).toBe(15);
            expect(triggerLayoutSpy).toHaveBeenCalled();
        });

        it("should preserve state when itemKey remains same", () => {
            let currentContext = { ...mockContainerContext };

            function TestComponent() {
                const [value, setValue] = useRecyclingState("initial");
                return (
                    <div>
                        <div data-testid="value">{value}</div>
                        <button onClick={() => setValue("updated")} data-testid="update">
                            Update
                        </button>
                    </div>
                );
            }

            const { rerender, getByTestId } = render(
                <ContextContainer.Provider value={currentContext}>
                    <TestComponent />
                </ContextContainer.Provider>
            );

            // Update state
            act(() => {
                getByTestId("update").click();
            });

            expect(getByTestId("value")).toHaveTextContent("updated");

            // Change other properties but keep itemKey same
            currentContext = {
                ...currentContext,
                index: 1,
                value: { id: 2, text: "Item 2" },
            };

            rerender(
                <ContextContainer.Provider value={currentContext}>
                    <TestComponent />
                </ContextContainer.Provider>
            );

            // State should be preserved
            expect(getByTestId("value")).toHaveTextContent("updated");
        });
    });

    describe("useIsLastItem", () => {
        it("should return true when item is in lastItemKeys", () => {
            mockStateContext.values.set("lastItemKeys", ["item-1", "item-5"]);
            const wrapper = createContextWrapper(mockContainerContext);

            const { result } = renderHook(() => useIsLastItem(), { wrapper });

            expect(result.current).toBe(true);
        });

        it("should return false when item is not in lastItemKeys", () => {
            mockStateContext.values.set("lastItemKeys", ["item-2", "item-5"]);
            const wrapper = createContextWrapper(mockContainerContext);

            const { result } = renderHook(() => useIsLastItem(), { wrapper });

            expect(result.current).toBe(false);
        });

        it("should return false when lastItemKeys is undefined", () => {
            const wrapper = createContextWrapper(mockContainerContext);

            const { result } = renderHook(() => useIsLastItem(), { wrapper });

            expect(result.current).toBe(false);
        });

        it("should return false when lastItemKeys is empty", () => {
            mockStateContext.values.set("lastItemKeys", []);
            const wrapper = createContextWrapper(mockContainerContext);

            const { result } = renderHook(() => useIsLastItem(), { wrapper });

            expect(result.current).toBe(false);
        });
    });

    describe("useListScrollSize", () => {
        it("should return scroll size from state", () => {
            const scrollSize = { width: 400, height: 600 };
            mockStateContext.values.set("scrollSize", scrollSize);
            const wrapper = createContextWrapper(mockContainerContext);

            const { result } = renderHook(() => useListScrollSize(), { wrapper });

            expect(result.current).toEqual(scrollSize);
        });

        it("should handle undefined scroll size", () => {
            const wrapper = createContextWrapper(mockContainerContext);

            const { result } = renderHook(() => useListScrollSize(), { wrapper });

            expect(result.current).toBeUndefined();
        });

        it("should update when scroll size changes", () => {
            const initialSize = { width: 400, height: 600 };
            mockStateContext.values.set("scrollSize", initialSize);
            const wrapper = createContextWrapper(mockContainerContext);

            const { result, rerender } = renderHook(() => useListScrollSize(), { wrapper });

            expect(result.current).toEqual(initialSize);

            const newSize = { width: 800, height: 1200 };
            mockStateContext.values.set("scrollSize", newSize);
            rerender();

            expect(result.current).toEqual(newSize);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle missing ContextContainer", () => {
            // Test without ContextContainer.Provider
            expect(() => {
                renderHook(() => useViewability(jest.fn()));
            }).toThrow();
        });

        it("should handle null container context", () => {
            const wrapper = createContextWrapper(null as any);

            expect(() => {
                renderHook(() => useViewability(jest.fn()), { wrapper });
            }).toThrow();
        });

        it("should handle rapid state updates in useRecyclingState", () => {
            const wrapper = createContextWrapper(mockContainerContext);

            const { result } = renderHook(() => useRecyclingState(0), { wrapper });

            // Rapid updates
            act(() => {
                for (let i = 0; i < 100; i++) {
                    result.current[1](prev => prev + 1);
                }
            });

            expect(result.current[0]).toBe(100);
            expect(triggerLayoutSpy).toHaveBeenCalledTimes(100);
        });

        it("should handle complex function initializers in useRecyclingState", () => {
            const complexInitializer = jest.fn(({ item, index }: LegendListRecyclingState<any>) => ({
                processedId: item.id * 2,
                processedIndex: index + 100,
                timestamp: Date.now(),
            }));

            const wrapper = createContextWrapper(mockContainerContext);

            const { result } = renderHook(() => useRecyclingState(complexInitializer), { wrapper });

            expect(complexInitializer).toHaveBeenCalledWith({
                index: 0,
                item: { id: 1, text: "Item 1" },
                prevIndex: undefined,
                prevItem: undefined,
            });

            expect(result.current[0]).toEqual({
                processedId: 2,
                processedIndex: 100,
                timestamp: expect.any(Number),
            });
        });

        it("should handle effect errors in useRecyclingEffect", () => {
            const errorEffect = jest.fn(() => {
                throw new Error("Effect error");
            });

            const wrapper = createContextWrapper(mockContainerContext);

            expect(() => {
                const { rerender } = renderHook(() => useRecyclingEffect(errorEffect), { wrapper });
                rerender(); // Trigger effect
            }).toThrow("Effect error");
        });
    });

    describe("performance and memory considerations", () => {
        it("should not create new functions on each render in useRecyclingState", () => {
            const wrapper = createContextWrapper(mockContainerContext);

            const { result, rerender } = renderHook(() => useRecyclingState("initial"), { wrapper });

            const firstSetState = result.current[1];
            rerender();
            const secondSetState = result.current[1];

            expect(firstSetState).toBe(secondSetState);
        });

        it("should clean up all callbacks on unmount", () => {
            const viewabilityCallback = jest.fn();
            const amountCallback = jest.fn();
            const wrapper = createContextWrapper(mockContainerContext);

            const { unmount: unmount1 } = renderHook(() => useViewability(viewabilityCallback), { wrapper });
            const { unmount: unmount2 } = renderHook(() => useViewabilityAmount(amountCallback), { wrapper });

            expect(mockStateContext.mapViewabilityCallbacks.size).toBe(1);
            expect(mockStateContext.mapViewabilityAmountCallbacks.size).toBe(1);

            unmount1();
            unmount2();

            expect(mockStateContext.mapViewabilityCallbacks.size).toBe(0);
            expect(mockStateContext.mapViewabilityAmountCallbacks.size).toBe(0);
        });

        it("should handle many simultaneous hook instances", () => {
            const callbacks: jest.Mock[] = [];
            const wrappers: any[] = [];

            // Create many container contexts
            for (let i = 0; i < 100; i++) {
                const callback = jest.fn();
                callbacks.push(callback);

                const containerContext = {
                    containerId: i,
                    itemKey: `item-${i}`,
                    index: i,
                    value: { id: i },
                    triggerLayout: jest.fn(),
                };

                const wrapper = createContextWrapper(containerContext);
                wrappers.push(wrapper);

                renderHook(() => useViewability(callback), { wrapper });
            }

            expect(mockStateContext.mapViewabilityCallbacks.size).toBe(100);

            // All callbacks should be registered with unique keys
            const keys = Array.from(mockStateContext.mapViewabilityCallbacks.keys());
            const uniqueKeys = new Set(keys);
            expect(uniqueKeys.size).toBe(100);
        });
    });
});