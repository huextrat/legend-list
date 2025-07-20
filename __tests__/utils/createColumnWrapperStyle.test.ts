import { describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { createColumnWrapperStyle } from "../../src/utils/createColumnWrapperStyle";
import type { ViewStyle } from "react-native";

describe("createColumnWrapperStyle", () => {
    describe("basic functionality", () => {
        it("should return undefined when no gap properties are present", () => {
            const style: ViewStyle = {
                backgroundColor: "red",
                padding: 10,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toBeUndefined();
            // Original style should be unchanged
            expect(style.backgroundColor).toBe("red");
            expect(style.padding).toBe(10);
        });

        it("should extract gap and remove it from contentContainerStyle", () => {
            const style: ViewStyle = {
                gap: 15,
                backgroundColor: "blue",
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: 15,
                columnGap: undefined,
                rowGap: undefined,
            });
            expect(style.gap).toBeUndefined();
            expect(style.backgroundColor).toBe("blue"); // Other properties preserved
        });

        it("should extract columnGap and remove it from contentContainerStyle", () => {
            const style: ViewStyle = {
                columnGap: 20,
                margin: 5,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: undefined,
                columnGap: 20,
                rowGap: undefined,
            });
            expect(style.columnGap).toBeUndefined();
            expect(style.margin).toBe(5);
        });

        it("should extract rowGap and remove it from contentContainerStyle", () => {
            const style: ViewStyle = {
                rowGap: 25,
                width: 100,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: undefined,
                columnGap: undefined,
                rowGap: 25,
            });
            expect(style.rowGap).toBeUndefined();
            expect(style.width).toBe(100);
        });

        it("should extract all gap properties together", () => {
            const style: ViewStyle = {
                gap: 10,
                columnGap: 15,
                rowGap: 20,
                padding: 5,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: 10,
                columnGap: 15,
                rowGap: 20,
            });
            expect(style.gap).toBeUndefined();
            expect(style.columnGap).toBeUndefined();
            expect(style.rowGap).toBeUndefined();
            expect(style.padding).toBe(5); // Other properties preserved
        });
    });

    describe("edge cases and data types", () => {
        it("should handle zero values (falsy, returns undefined)", () => {
            const style: ViewStyle = {
                gap: 0,
                columnGap: 0,
                rowGap: 0,
            };

            const result = createColumnWrapperStyle(style);

            // Zero is falsy, so function returns undefined
            expect(result).toBeUndefined();
            // Style should be unchanged since condition failed
            expect(style.gap).toBe(0);
            expect(style.columnGap).toBe(0);
            expect(style.rowGap).toBe(0);
        });

        it("should handle negative values", () => {
            const style: ViewStyle = {
                gap: -5,
                columnGap: -10,
                rowGap: -15,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: -5,
                columnGap: -10,
                rowGap: -15,
            });
        });

        it("should handle floating point values", () => {
            const style: ViewStyle = {
                gap: 12.5,
                columnGap: 7.25,
                rowGap: 18.75,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: 12.5,
                columnGap: 7.25,
                rowGap: 18.75,
            });
        });

        it("should handle very large values", () => {
            const style: ViewStyle = {
                gap: Number.MAX_SAFE_INTEGER,
                columnGap: 999999,
                rowGap: 1000000,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: Number.MAX_SAFE_INTEGER,
                columnGap: 999999,
                rowGap: 1000000,
            });
        });

        it("should handle special numeric values", () => {
            const style: ViewStyle = {
                gap: NaN,
                columnGap: Infinity,
                rowGap: -Infinity,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: NaN,
                columnGap: Infinity,
                rowGap: -Infinity,
            });
        });

        it("should handle non-numeric values (type assertion)", () => {
            const style: ViewStyle = {
                gap: "10px" as any,
                columnGap: "auto" as any,
                rowGap: null as any,
            };

            const result = createColumnWrapperStyle(style);

            // Function uses type assertions, so these will be cast to numbers
            expect(result).toEqual({
                gap: "10px",
                columnGap: "auto", 
                rowGap: null,
            });
        });
    });

    describe("partial gap properties", () => {
        it("should handle only gap property", () => {
            const style: ViewStyle = {
                gap: 12,
                backgroundColor: "green",
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: 12,
                columnGap: undefined,
                rowGap: undefined,
            });
        });

        it("should handle only columnGap property", () => {
            const style: ViewStyle = {
                columnGap: 8,
                margin: 4,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: undefined,
                columnGap: 8,
                rowGap: undefined,
            });
        });

        it("should handle only rowGap property", () => {
            const style: ViewStyle = {
                rowGap: 16,
                width: "100%",
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: undefined,
                columnGap: undefined,
                rowGap: 16,
            });
        });

        it("should handle gap and columnGap only", () => {
            const style: ViewStyle = {
                gap: 10,
                columnGap: 5,
                padding: 20,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: 10,
                columnGap: 5,
                rowGap: undefined,
            });
        });

        it("should handle gap and rowGap only", () => {
            const style: ViewStyle = {
                gap: 14,
                rowGap: 7,
                margin: 3,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: 14,
                columnGap: undefined,
                rowGap: 7,
            });
        });

        it("should handle columnGap and rowGap only", () => {
            const style: ViewStyle = {
                columnGap: 18,
                rowGap: 22,
                flexDirection: "row",
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: undefined,
                columnGap: 18,
                rowGap: 22,
            });
        });
    });

    describe("style mutation behavior", () => {
        it("should mutate the original style object", () => {
            const style: ViewStyle = {
                gap: 15,
                columnGap: 10,
                rowGap: 20,
                backgroundColor: "yellow",
                padding: 5,
            };

            const originalStyle = { ...style }; // Keep a copy for comparison

            createColumnWrapperStyle(style);

            // Gap properties should be removed
            expect(style.gap).toBeUndefined();
            expect(style.columnGap).toBeUndefined();
            expect(style.rowGap).toBeUndefined();

            // Other properties should remain
            expect(style.backgroundColor).toBe(originalStyle.backgroundColor);
            expect(style.padding).toBe(originalStyle.padding);
        });

        it("should not mutate style when no gap properties exist", () => {
            const style: ViewStyle = {
                backgroundColor: "purple",
                margin: 8,
                width: 200,
            };

            const originalStyle = { ...style };

            const result = createColumnWrapperStyle(style);

            expect(result).toBeUndefined();
            expect(style).toEqual(originalStyle); // Should be unchanged
        });

        it("should handle already undefined gap properties", () => {
            const style: ViewStyle = {
                gap: undefined,
                columnGap: 12,
                rowGap: undefined,
                padding: 6,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: undefined,
                columnGap: 12,
                rowGap: undefined,
            });
            expect(style.columnGap).toBeUndefined();
        });
    });

    describe("complex style objects", () => {
        it("should handle style with many properties", () => {
            const style: ViewStyle = {
                backgroundColor: "red",
                margin: 10,
                padding: 15,
                gap: 8,
                columnGap: 12,
                rowGap: 6,
                borderWidth: 2,
                borderColor: "blue",
                borderRadius: 5,
                shadowColor: "black",
                shadowOffset: { width: 1, height: 1 },
                shadowOpacity: 0.3,
                shadowRadius: 3,
                elevation: 4,
                width: "100%",
                height: 200,
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "stretch",
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: 8,
                columnGap: 12,
                rowGap: 6,
            });

            // Gap properties should be removed
            expect(style.gap).toBeUndefined();
            expect(style.columnGap).toBeUndefined();
            expect(style.rowGap).toBeUndefined();

            // All other properties should remain
            expect(style.backgroundColor).toBe("red");
            expect(style.margin).toBe(10);
            expect(style.padding).toBe(15);
            expect(style.borderWidth).toBe(2);
            expect(style.flexDirection).toBe("column");
            // ... etc
        });

        it("should handle empty style object", () => {
            const style: ViewStyle = {};

            const result = createColumnWrapperStyle(style);

            expect(result).toBeUndefined();
            expect(style).toEqual({});
        });

        it("should handle style with nested objects", () => {
            const style: ViewStyle = {
                gap: 10,
                transform: [{ translateX: 5 }, { scale: 1.2 }],
                shadowOffset: { width: 2, height: 3 },
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: 10,
                columnGap: undefined,
                rowGap: undefined,
            });
            expect(style.gap).toBeUndefined();
            expect(style.transform).toEqual([{ translateX: 5 }, { scale: 1.2 }]);
            expect(style.shadowOffset).toEqual({ width: 2, height: 3 });
        });
    });

    describe("integration scenarios", () => {
        it("should work with typical FlatList column layout", () => {
            const style: ViewStyle = {
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: "#f5f5f5",
                gap: 12, // Space between items
                columnGap: 8, // Horizontal space between columns
                rowGap: 16, // Vertical space between rows
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: 12,
                columnGap: 8,
                rowGap: 16,
            });

            // Style should still have layout properties but no gap properties
            expect(style.paddingHorizontal).toBe(16);
            expect(style.paddingVertical).toBe(8);
            expect(style.backgroundColor).toBe("#f5f5f5");
            expect(style.gap).toBeUndefined();
            expect(style.columnGap).toBeUndefined();
            expect(style.rowGap).toBeUndefined();
        });

        it("should work with grid-like layouts", () => {
            const style: ViewStyle = {
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: 20,
                padding: 10,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: 20,
                columnGap: undefined,
                rowGap: undefined,
            });

            expect(style.flexDirection).toBe("row");
            expect(style.flexWrap).toBe("wrap");
            expect(style.justifyContent).toBe("space-between");
            expect(style.gap).toBeUndefined();
        });

        it("should handle responsive design patterns", () => {
            const style: ViewStyle = {
                width: "100%",
                maxWidth: 600,
                marginHorizontal: "auto",
                columnGap: 16,
                rowGap: 24,
                padding: 20,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: undefined,
                columnGap: 16,
                rowGap: 24,
            });

            expect(style.width).toBe("100%");
            expect(style.maxWidth).toBe(600);
            expect(style.marginHorizontal).toBe("auto");
            expect(style.padding).toBe(20);
        });
    });

    describe("performance considerations", () => {
        it("should handle rapid successive calls efficiently", () => {
            const start = performance.now();

            for (let i = 0; i < 1000; i++) {
                const style: ViewStyle = {
                    gap: i % 20,
                    columnGap: (i + 5) % 15,
                    rowGap: (i + 10) % 25,
                    padding: i % 10,
                };

                createColumnWrapperStyle(style);
            }

            const duration = performance.now() - start;
            expect(duration).toBeLessThan(50); // Should be fast
        });

        it("should not create unnecessary objects when no gaps exist", () => {
            const style: ViewStyle = {
                backgroundColor: "red",
                padding: 10,
                margin: 5,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toBeUndefined(); // No object created
        });

        it("should handle large style objects efficiently", () => {
            // Create a style with many properties
            const style: ViewStyle = {};
            for (let i = 0; i < 100; i++) {
                (style as any)[`property${i}`] = `value${i}`;
            }
            style.gap = 15;

            const start = performance.now();
            const result = createColumnWrapperStyle(style);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(5);
            expect(result?.gap).toBe(15);
            expect(style.gap).toBeUndefined();
        });
    });

    describe("type safety and edge cases", () => {
        it("should handle style with undefined properties", () => {
            const style: ViewStyle = {
                gap: 10,
                columnGap: undefined,
                rowGap: 15,
                backgroundColor: undefined,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: 10,
                columnGap: undefined,
                rowGap: 15,
            });
        });

        it("should handle style with mixed defined/undefined gap properties", () => {
            const style: ViewStyle = {
                gap: undefined,
                columnGap: 8,
                rowGap: undefined,
            };

            const result = createColumnWrapperStyle(style);

            expect(result).toEqual({
                gap: undefined,
                columnGap: 8,
                rowGap: undefined,
            });
        });

        it("should handle readonly style properties", () => {
            const style: ViewStyle = Object.freeze({
                gap: 12,
                backgroundColor: "blue",
            });

            // Function will try to mutate frozen object
            expect(() => {
                createColumnWrapperStyle(style);
            }).toThrow(); // Should throw in strict mode when trying to mutate frozen object
        });
    });
});