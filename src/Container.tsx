import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DimensionValue, LayoutChangeEvent, StyleProp, View, ViewStyle } from "react-native";
import { Text } from "react-native";
import { ContextContainer, type ContextContainerType } from "./ContextContainer";
import { LeanView } from "./LeanView";
import { ANCHORED_POSITION_OUT_OF_VIEW, ENABLE_DEVMODE, IsNewArchitecture } from "./constants";
import { isNullOrUndefined } from "./helpers";
import { useArr$, useStateContext } from "./state";

export const Container = <ItemT,>({
    id,
    recycleItems,
    horizontal,
    getRenderedItem,
    updateItemSize,
    ItemSeparatorComponent,
}: {
    id: number;
    recycleItems?: boolean;
    horizontal: boolean;
    getRenderedItem: (key: string) => { index: number; item: ItemT; renderedItem: React.ReactNode } | null;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
}) => {
    const ctx = useStateContext();
    const columnWrapperStyle = ctx.columnWrapperStyle;

    const [
        maintainVisibleContentPosition,
        position = ANCHORED_POSITION_OUT_OF_VIEW,
        column = 0,
        numColumns,
        lastItemKeys,
        itemKey,
        data,
        extraData,
    ] = useArr$([
        "maintainVisibleContentPosition",
        `containerPosition${id}`,
        `containerColumn${id}`,
        "numColumns",
        "lastItemKeys",
        `containerItemKey${id}`,
        `containerItemData${id}`,
        "extraData",
    ]);

    const refLastSize = useRef<{ width: number; height: number }>();
    const ref = useRef<View>(null);
    const [layoutRenderCount, forceLayoutRender] = useState(0);

    const otherAxisPos: DimensionValue | undefined = numColumns > 1 ? `${((column - 1) / numColumns) * 100}%` : 0;
    const otherAxisSize: DimensionValue | undefined = numColumns > 1 ? `${(1 / numColumns) * 100}%` : undefined;
    const isALastItem = lastItemKeys.includes(itemKey);

    let paddingStyles: ViewStyle | undefined;
    if (columnWrapperStyle) {
        // Extract gap properties from columnWrapperStyle if available
        const { columnGap, rowGap, gap } = columnWrapperStyle;

        // Create padding styles for both horizontal and vertical layouts with multiple columns
        if (horizontal) {
            paddingStyles = {
                paddingRight: !isALastItem ? columnGap || gap || undefined : undefined,
                paddingVertical: numColumns > 1 ? (rowGap || gap || 0) / 2 : undefined,
            };
        } else {
            paddingStyles = {
                paddingBottom: !isALastItem ? rowGap || gap || undefined : undefined,
                paddingHorizontal: numColumns > 1 ? (columnGap || gap || 0) / 2 : undefined,
            };
        }
    }

    const style: StyleProp<ViewStyle> = horizontal
        ? {
              flexDirection: ItemSeparatorComponent ? "row" : undefined,
              position: "absolute",
              top: otherAxisPos,
              height: otherAxisSize,
              left: position.relativeCoordinate,
              ...(paddingStyles || {}),
          }
        : {
              position: "absolute",
              left: otherAxisPos,
              right: numColumns > 1 ? null : 0,
              width: otherAxisSize,
              top: position.relativeCoordinate,
              ...(paddingStyles || {}),
          };

    const renderedItemInfo = useMemo(
        () => (itemKey !== undefined ? getRenderedItem(itemKey) : null),
        [itemKey, data, extraData],
    );
    const { index, renderedItem } = renderedItemInfo || {};

    const didLayout = false;
    const triggerLayout = useCallback(() => {
        forceLayoutRender((v) => v + 1);
    }, []);

    const onLayout = (event: LayoutChangeEvent) => {
        if (!isNullOrUndefined(itemKey)) {
            let layout: { width: number; height: number } = event.nativeEvent.layout;
            const size = layout[horizontal ? "width" : "height"];

            const doUpdate = () => {
                refLastSize.current = { width: layout.width, height: layout.height };
                updateItemSize(itemKey, layout);
            };

            if (IsNewArchitecture || size > 0) {
                doUpdate();
            } else {
                // On old architecture, the size can be 0 sometimes, maybe when not fully rendered?
                // So we need to make sure it's actually rendered and measure it to make sure it's actually 0.
                ref.current?.measure?.((x, y, width, height) => {
                    layout = { width, height };
                    doUpdate();
                });
            }
        }
    };

    if (IsNewArchitecture) {
        // New architecture supports unstable_getBoundingClientRect for getting layout synchronously
        useLayoutEffect(() => {
            if (!isNullOrUndefined(itemKey)) {
                // @ts-expect-error unstable_getBoundingClientRect is unstable and only on Fabric
                const measured = ref.current?.unstable_getBoundingClientRect?.();
                if (measured) {
                    const size = Math.floor(measured[horizontal ? "width" : "height"] * 8) / 8;

                    if (size) {
                        updateItemSize(itemKey, measured);
                    }
                }
            }
        }, [itemKey, layoutRenderCount, isALastItem]);
    } else {
        // Since old architecture cannot use unstable_getBoundingClientRect it needs to ensure that
        // all containers updateItemSize even if the container did not resize.
        useEffect(() => {
            // Catch a bug where a container is reused and is the exact same size as the previous item
            // so it does not fire an onLayout, so we need to trigger it manually.
            // TODO: There must be a better way to do this?
            if (!isNullOrUndefined(itemKey)) {
                const timeout = setTimeout(() => {
                    if (!didLayout && refLastSize.current) {
                        updateItemSize(itemKey, refLastSize.current);
                    }
                }, 16);
                return () => {
                    clearTimeout(timeout);
                };
            }
        }, [itemKey]);
    }

    const contextValue = useMemo<ContextContainerType>(() => {
        ctx.viewRefs.set(id, ref);
        return { containerId: id, itemKey, index: index!, value: data, triggerLayout };
    }, [id, itemKey, index, data]);

    const contentFragment = (
        <React.Fragment key={recycleItems ? undefined : itemKey}>
            <ContextContainer.Provider value={contextValue}>
                {renderedItem}
                {renderedItemInfo && ItemSeparatorComponent && !isALastItem && (
                    <ItemSeparatorComponent leadingItem={renderedItemInfo.item} />
                )}
            </ContextContainer.Provider>
        </React.Fragment>
    );

    // TODO: Is this needed?
    // If maintainVisibleContentPosition is enabled, we need a way items to grow upwards
    if (!IsNewArchitecture && maintainVisibleContentPosition) {
        const anchorStyle: StyleProp<ViewStyle> = horizontal
            ? position.type === "top"
                ? { position: "absolute", left: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "stretch" }
                : { position: "absolute", right: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "stretch" }
            : position.type === "top"
              ? { position: "absolute", top: 0, left: 0, right: 0 }
              : { position: "absolute", bottom: 0, left: 0, right: 0 };

        if (__DEV__ && ENABLE_DEVMODE) {
            anchorStyle.borderColor = position.type === "top" ? "red" : "blue";
            anchorStyle.borderWidth = 1;
        }
        return (
            <LeanView style={style}>
                <LeanView style={[anchorStyle, paddingStyles]} onLayout={onLayout} ref={ref}>
                    {contentFragment}
                    {__DEV__ && ENABLE_DEVMODE && (
                        <Text style={{ position: "absolute", top: 0, left: 0, zIndex: 1000 }}>{position.top}</Text>
                    )}
                </LeanView>
            </LeanView>
        );
    }

    // Use a reactive View to ensure the container element itself
    // is not rendered when style changes, only the style prop.
    // This is a big perf boost to do less work rendering.
    return (
        <LeanView style={style} onLayout={onLayout} ref={ref}>
            {contentFragment}
        </LeanView>
    );
};
