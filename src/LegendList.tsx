import * as React from "react";
import {
    type ForwardedRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Dimensions,
    type LayoutChangeEvent,
    type LayoutRectangle,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    Platform,
    RefreshControl,
    type ScrollView,
    StyleSheet,
} from "react-native";
import { DebugView } from "./DebugView";
import { ListComponent } from "./ListComponent";
import { ScrollAdjustHandler } from "./ScrollAdjustHandler";
import { calculateOffsetForIndex } from "./calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "./calculateOffsetWithOffsetPosition";
import { checkAllSizesKnown } from "./checkAllSizesKnown";
import { checkAtBottom } from "./checkAtBottom";
import { checkAtTop } from "./checkAtTop";
import { ENABLE_DEBUG_VIEW, IsNewArchitecture, POSITION_OUT_OF_VIEW } from "./constants";
import { createColumnWrapperStyle } from "./createColumnWrapperStyle";
import { doMaintainScrollAtEnd } from "./doMaintainScrollAtEnd";
import { finishScrollTo } from "./finishScrollTo";
import { getId } from "./getId";
import { getItemSize } from "./getItemSize";
import { getScrollVelocity } from "./getScrollVelocity";
import { comparatorByDistance, comparatorDefault, extractPadding, roundSize, warnDevOnce } from "./helpers";
import { requestAdjust } from "./requestAdjust";
import { StateProvider, getContentSize, peek$, set$, useStateContext } from "./state";
import type {
    InternalState,
    LegendListProps,
    LegendListRef,
    ScrollIndexWithOffsetPosition,
    ScrollState,
} from "./types";
import { typedForwardRef } from "./types";
import { updateItemSize } from "./updateItemSize";
import { updateTotalSize } from "./updateTotalSize";
import { useCombinedRef } from "./useCombinedRef";
import { useInit } from "./useInit";
import { setupViewability, updateViewableItems } from "./viewability";

const DEFAULT_DRAW_DISTANCE = 250;
const DEFAULT_ITEM_SIZE = 100;

export const LegendList = typedForwardRef(function LegendList<T>(
    props: LegendListProps<T>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    return (
        <StateProvider>
            <LegendListInner {...props} ref={forwardedRef} />
        </StateProvider>
    );
});

const LegendListInner = typedForwardRef(function LegendListInner<T>(
    props: LegendListProps<T>,
    forwardedRef: ForwardedRef<LegendListRef>,
) {
    const {
        data: dataProp = [],
        initialScrollIndex: initialScrollIndexProp,
        initialScrollOffset,
        horizontal,
        drawDistance = 250,
        recycleItems = false,
        onEndReachedThreshold = 0.5,
        onStartReachedThreshold = 0.5,
        maintainScrollAtEnd = false,
        maintainScrollAtEndThreshold = 0.1,
        alignItemsAtEnd = false,
        maintainVisibleContentPosition = false,
        onScroll: onScrollProp,
        onMomentumScrollEnd,
        numColumns: numColumnsProp = 1,
        columnWrapperStyle,
        keyExtractor: keyExtractorProp,
        renderItem,
        estimatedListSize,
        estimatedItemSize: estimatedItemSizeProp,
        getEstimatedItemSize,
        suggestEstimatedItemSize,
        ListHeaderComponent,
        ListEmptyComponent,
        onItemSizeChanged,
        refScrollView,
        waitForInitialLayout = true,
        extraData,
        contentContainerStyle: contentContainerStyleProp,
        style: styleProp,
        onLayout: onLayoutProp,
        onRefresh,
        refreshing,
        progressViewOffset,
        refreshControl,
        initialContainerPoolRatio = 2,
        viewabilityConfig,
        viewabilityConfigCallbackPairs,
        onViewableItemsChanged,
        onStartReached,
        onEndReached,
        ...rest
    } = props;

    const [renderNum, setRenderNum] = useState(0);
    const initialScroll: ScrollIndexWithOffsetPosition | undefined =
        typeof initialScrollIndexProp === "number" ? { index: initialScrollIndexProp } : initialScrollIndexProp;
    const initialScrollIndex = initialScroll?.index;

    const refLoadStartTime = useRef<number>(Date.now());
    const [canRender, setCanRender] = React.useState(!IsNewArchitecture);

    const contentContainerStyle = { ...StyleSheet.flatten(contentContainerStyleProp) };
    const style = { ...StyleSheet.flatten(styleProp) };
    const stylePaddingTopState = extractPadding(style, contentContainerStyle, "Top");
    const stylePaddingBottomState = extractPadding(style, contentContainerStyle, "Bottom");

    const ctx = useStateContext();
    ctx.columnWrapperStyle =
        columnWrapperStyle || (contentContainerStyle ? createColumnWrapperStyle(contentContainerStyle) : undefined);

    const refScroller = useRef<ScrollView>(null) as React.MutableRefObject<ScrollView>;
    const combinedRef = useCombinedRef(refScroller, refScrollView);
    const estimatedItemSize = estimatedItemSizeProp ?? DEFAULT_ITEM_SIZE;
    const scrollBuffer = (drawDistance ?? DEFAULT_DRAW_DISTANCE) || 1;
    const keyExtractor = keyExtractorProp ?? ((item, index) => index.toString());

    const refState = useRef<InternalState>();

    if (!refState.current) {
        const initialScrollLength = (estimatedListSize ??
            (IsNewArchitecture ? { width: 0, height: 0 } : Dimensions.get("window")))[horizontal ? "width" : "height"];

        refState.current = {
            sizes: new Map(),
            positions: new Map(),
            columns: new Map(),
            pendingAdjust: 0,
            isStartReached: false,
            isEndReached: false,
            isAtEnd: false,
            isAtStart: false,
            scrollLength: initialScrollLength,
            startBuffered: -1,
            startNoBuffer: -1,
            endBuffered: -1,
            endNoBuffer: -1,
            firstFullyOnScreenIndex: -1,
            scroll: 0,
            totalSize: 0,
            timeouts: new Set(),
            viewabilityConfigCallbackPairs: undefined as never,
            renderItem: undefined as never,
            scrollAdjustHandler: new ScrollAdjustHandler(ctx),
            nativeMarginTop: 0,
            scrollPrev: 0,
            scrollPrevTime: 0,
            scrollTime: 0,
            scrollPending: 0,
            indexByKey: new Map(),
            scrollHistory: [],
            sizesKnown: new Map(),
            timeoutSizeMessage: 0,
            startReachedBlockedByTimer: false,
            endReachedBlockedByTimer: false,
            scrollForNextCalculateItemsInView: undefined,
            enableScrollForNextCalculateItemsInView: true,
            minIndexSizeChanged: 0,
            queuedCalculateItemsInView: 0,
            lastBatchingAction: Date.now(),
            averageSizes: {},
            idsInView: [],
            containerItemKeys: new Set(),
            idCache: new Map(),
            props: {} as any,
            calculateItemsInView: undefined as any,
            refScroller: undefined as any,
        };

        set$(ctx, "maintainVisibleContentPosition", maintainVisibleContentPosition);
        set$(ctx, "extraData", extraData);
    }

    const state = refState.current!;

    const didDataChange = state.props.data !== dataProp;
    state.props = {
        alignItemsAtEnd,
        data: dataProp,
        estimatedItemSize,
        maintainScrollAtEnd,
        maintainScrollAtEndThreshold,
        onEndReachedThreshold,
        onStartReachedThreshold,
        stylePaddingBottom: stylePaddingBottomState,
        horizontal: !!horizontal,
        maintainVisibleContentPosition,
        onItemSizeChanged,
        suggestEstimatedItemSize: !!suggestEstimatedItemSize,
        keyExtractor,
        onScroll: onScrollProp,
        getEstimatedItemSize,
        onStartReached,
        onEndReached,
    };

    const updateAllPositions = (dataChanged?: boolean) => {
        const { averageSizes, columns, indexByKey, positions, firstFullyOnScreenIndex, idCache, sizesKnown } = state;
        const data = state.props.data;
        const numColumns = peek$(ctx, "numColumns") ?? numColumnsProp;
        const indexByKeyForChecking = __DEV__ ? new Map() : undefined;
        const scrollVelocity = getScrollVelocity(state);

        if (dataChanged) {
            indexByKey.clear();
            idCache.clear();
        }

        // TODO: Hook this up to actual item types later once we have item types
        const itemType = "";
        let averageSize = averageSizes[itemType]?.avg;
        if (averageSize !== undefined) {
            averageSize = roundSize(averageSize);
        }

        // Check if we should use backwards optimization when scrolling up
        const shouldUseBackwards =
            !dataChanged && scrollVelocity < 0 && firstFullyOnScreenIndex > 5 && firstFullyOnScreenIndex < data!.length;

        if (shouldUseBackwards && firstFullyOnScreenIndex !== undefined) {
            // Get the current position of firstFullyOnScreenIndex as anchor
            const anchorId = getId(state, firstFullyOnScreenIndex)!;
            const anchorPosition = positions.get(anchorId);

            // If we don't have the anchor position, fall back to regular behavior
            if (anchorPosition !== undefined) {
                // Start from the anchor and go backwards
                let currentRowTop = anchorPosition;
                let maxSizeInRow = 0;
                let bailout = false;

                // Process items backwards from firstFullyOnScreenIndex - 1 to 0
                for (let i = firstFullyOnScreenIndex - 1; i >= 0; i--) {
                    const id = idCache.get(i) ?? getId(state, i)!;
                    const size = sizesKnown.get(id) ?? getItemSize(state, id, i, data[i], averageSize);
                    const itemColumn = columns.get(id)!;

                    maxSizeInRow = Math.max(maxSizeInRow, size);

                    // When we reach column 1, we're at the start of a new row going backwards
                    if (itemColumn === 1) {
                        currentRowTop -= maxSizeInRow;
                        maxSizeInRow = 0;
                    }

                    // Check if position goes too low - bail if so
                    if (currentRowTop < -2000) {
                        bailout = true;
                        break;
                    }

                    // Update position for this item (columns and indexByKey already set)
                    positions.set(id, currentRowTop);
                }

                if (!bailout) {
                    // We successfully processed backwards, we're done
                    updateTotalSize(ctx, state);
                    return;
                }
            }
        }

        // Regular ascending behavior (either not scrolling up or bailed out)
        let currentRowTop = 0;
        let column = 1;
        let maxSizeInRow = 0;

        const hasColumns = numColumns > 1;
        const needsIndexByKey = dataChanged || indexByKey.size === 0;

        // Note that this loop is micro-optimized because it's a hot path
        const dataLength = data!.length;
        for (let i = 0; i < dataLength; i++) {
            // Inline the map get calls to avoid the overhead of the function call
            const id = idCache.get(i) ?? getId(state, i)!;
            const size = sizesKnown.get(id) ?? getItemSize(state, id, i, data[i], averageSize);

            // Set index mapping for this item
            if (__DEV__ && needsIndexByKey) {
                if (indexByKeyForChecking!.has(id)) {
                    console.error(
                        `[legend-list] Error: Detected overlapping key (${id}) which causes missing items and gaps and other terrrible things. Check that keyExtractor returns unique values.`,
                    );
                }
                indexByKeyForChecking!.set(id, i);
            }

            // Set position for this item
            positions.set(id, currentRowTop);

            // Update indexByKey if needed
            if (needsIndexByKey) {
                indexByKey.set(id, i);
            }

            // Set column for this item
            columns.set(id, column);

            if (hasColumns) {
                if (size > maxSizeInRow) {
                    maxSizeInRow = size;
                }

                column++;
                if (column > numColumns) {
                    // Move to next row
                    currentRowTop += maxSizeInRow;
                    column = 1;
                    maxSizeInRow = 0;
                }
            } else {
                currentRowTop += size;
            }
        }

        updateTotalSize(ctx, state);
    };

    const scrollToIndex = ({
        index,
        viewOffset = 0,
        animated = true,
        viewPosition,
    }: Parameters<LegendListRef["scrollToIndex"]>[0]) => {
        if (index >= state.props.data.length) {
            index = state.props.data.length - 1;
        } else if (index < 0) {
            index = 0;
        }

        const firstIndexOffset = calculateOffsetForIndex(ctx, state, index);

        const isLast = index === state.props.data.length - 1;
        if (isLast && viewPosition === undefined) {
            viewPosition = 1;
        }
        const firstIndexScrollPostion = firstIndexOffset - viewOffset;

        state.scrollForNextCalculateItemsInView = undefined;

        scrollTo({ offset: firstIndexScrollPostion, animated, index, viewPosition: viewPosition ?? 0, viewOffset });
    };

    const setDidLayout = () => {
        state.queuedInitialLayout = true;
        checkAtBottom(ctx, state);

        set$(ctx, "containersDidLayout", true);

        if (props.onLoad) {
            props.onLoad({ elapsedTimeInMs: Date.now() - refLoadStartTime.current });
        }
    };

    const prepareMVCP = useCallback((): (() => void) => {
        const { positions, scrollingTo } = state;

        let prevPosition: number;
        let targetId: string | undefined;
        let targetIndex: number | undefined;
        const scrollTarget = scrollingTo?.index;

        if (maintainVisibleContentPosition) {
            const indexByKey = state.indexByKey;

            if (scrollTarget !== undefined) {
                // If we're currently scrolling to a target index, do MVCP for its position
                targetId = getId(state, scrollTarget);
                targetIndex = scrollTarget;
            } else if (state.idsInView.length > 0 && peek$(ctx, "containersDidLayout")) {
                // Do MVCP for the first item fully in view
                targetId = state.idsInView.find((id) => indexByKey.get(id) !== undefined);
                targetIndex = indexByKey.get(targetId!);
            }

            if (targetId !== undefined && targetIndex !== undefined) {
                prevPosition = positions.get(targetId)!;
            }
        }

        // Return a function to do MVCP based on the prepared values
        return () => {
            if (targetId !== undefined && prevPosition !== undefined) {
                const newPosition = positions.get(targetId);

                if (newPosition !== undefined) {
                    const positionDiff = newPosition - prevPosition;

                    if (Math.abs(positionDiff) > 0.1) {
                        requestAdjust(ctx, state, positionDiff);
                    }
                }
            }
        };
    }, []);

    const calculateItemsInView = useCallback((params: { doMVCP?: boolean; dataChanged?: boolean } = {}) => {
        const {
            scrollLength,
            startBufferedId: startBufferedIdOrig,
            positions,
            columns,
            containerItemKeys,
            idCache,
            sizes,
            indexByKey,
            scrollForNextCalculateItemsInView,
            enableScrollForNextCalculateItemsInView,
            minIndexSizeChanged,
        } = state!;
        const data = state.props.data;
        if (!data || scrollLength === 0) {
            return;
        }

        const totalSize = peek$(ctx, "totalSize");
        const topPad = peek$(ctx, "stylePaddingTop") + peek$(ctx, "headerSize");
        const numColumns = peek$(ctx, "numColumns");
        const previousScrollAdjust = 0;
        const { dataChanged, doMVCP } = params;
        const speed = getScrollVelocity(refState.current!);

        if (doMVCP || dataChanged) {
            // TODO: This should only run if a size changed or items changed
            // Handle maintainVisibleContentPosition adjustment early
            const checkMVCP = doMVCP ? prepareMVCP() : undefined;

            // Update all positions upfront so we can assume they're correct
            updateAllPositions(dataChanged);

            checkMVCP?.();
        }

        const scrollExtra = 0;
        // Disabled this optimization for now because it was causing blanks to appear sometimes
        // We may need to control speed calculation better, or not have a 5 item history to avoid this issue
        // const scrollExtra = Math.max(-16, Math.min(16, speed)) * 24;

        const { queuedInitialLayout } = state!;
        let { scroll: scrollState } = state!;

        // If this is before the initial layout, and we have an initialScrollIndex,
        // then ignore the actual scroll which might be shifting due to scrollAdjustHandler
        // and use the calculated offset of the initialScrollIndex instead.
        if (!queuedInitialLayout && initialScroll) {
            const updatedOffset = calculateOffsetWithOffsetPosition(
                state,
                calculateOffsetForIndex(ctx, state, initialScroll.index),
                initialScroll,
            );
            scrollState = updatedOffset;
        }

        const scrollAdjustPad = -previousScrollAdjust - topPad;
        let scroll = scrollState + scrollExtra + scrollAdjustPad;

        // Sometimes we may have scrolled past the visible area which can make items at the top of the
        // screen not render. So make sure we clamp scroll to the end.
        if (scroll + scrollLength > totalSize) {
            scroll = totalSize - scrollLength;
        }

        if (ENABLE_DEBUG_VIEW) {
            set$(ctx, "debugRawScroll", scrollState);
            set$(ctx, "debugComputedScroll", scroll);
        }

        let scrollBufferTop = scrollBuffer;
        let scrollBufferBottom = scrollBuffer;

        if (speed > 0) {
            scrollBufferTop = scrollBuffer * 0.5;
            scrollBufferBottom = scrollBuffer * 1.5;
        } else {
            scrollBufferTop = scrollBuffer * 1.5;
            scrollBufferBottom = scrollBuffer * 0.5;
        }

        const scrollTopBuffered = scroll - scrollBufferTop;
        const scrollBottom = scroll + scrollLength;
        const scrollBottomBuffered = scrollBottom + scrollBufferBottom;

        // Check precomputed scroll range to see if we can skip this check
        if (scrollForNextCalculateItemsInView) {
            const { top, bottom } = scrollForNextCalculateItemsInView;
            if (scrollTopBuffered > top && scrollBottomBuffered < bottom) {
                return;
            }
        }

        let startNoBuffer: number | null = null;
        let startBuffered: number | null = null;
        let startBufferedId: string | null = null;
        let endNoBuffer: number | null = null;
        let endBuffered: number | null = null;

        let loopStart: number = startBufferedIdOrig ? indexByKey.get(startBufferedIdOrig) || 0 : 0;

        if (minIndexSizeChanged !== undefined) {
            loopStart = Math.min(minIndexSizeChanged, loopStart);
            state.minIndexSizeChanged = undefined;
        }

        // Go backwards from the last start position to find the first item that is in view
        // This is an optimization to avoid looping through all items, which could slow down
        // when scrolling at the end of a long list.
        for (let i = loopStart; i >= 0; i--) {
            const id = idCache.get(i) ?? getId(state, i)!;
            const top = positions.get(id)!;
            const size = sizes.get(id) ?? getItemSize(state, id, i, data[i]);
            const bottom = top + size;

            if (bottom > scroll - scrollBuffer) {
                loopStart = i;
            } else {
                break;
            }
        }

        const loopStartMod = loopStart % numColumns;
        if (loopStartMod > 0) {
            loopStart -= loopStartMod;
        }

        let foundEnd = false;
        let nextTop: number | undefined;
        let nextBottom: number | undefined;

        // TODO PERF: Could cache this while looping through numContainers at the end of this function
        // This takes 0.03 ms in an example in the ios simulator
        const prevNumContainers = ctx.values.get("numContainers") as number;
        let maxIndexRendered = 0;
        for (let i = 0; i < prevNumContainers; i++) {
            const key = peek$(ctx, `containerItemKey${i}`);
            if (key !== undefined) {
                const index = indexByKey.get(key)!;
                maxIndexRendered = Math.max(maxIndexRendered, index);
            }
        }

        let firstFullyOnScreenIndex: number | undefined;

        // scan data forwards
        // Continue until we've found the end and we've updated positions of all items that were previously in view
        const dataLength = data!.length;
        for (let i = Math.max(0, loopStart); i < dataLength && (!foundEnd || i <= maxIndexRendered); i++) {
            const id = idCache.get(i) ?? getId(state, i)!;
            const size = sizes.get(id) ?? getItemSize(state, id, i, data[i]);
            const top = positions.get(id)!;

            if (!foundEnd) {
                if (startNoBuffer === null && top + size > scroll) {
                    startNoBuffer = i;
                }
                // Subtract 10px for a little buffer so it can be slightly off screen
                if (firstFullyOnScreenIndex === undefined && top >= scroll - 10) {
                    firstFullyOnScreenIndex = i;
                }

                if (startBuffered === null && top + size > scrollTopBuffered) {
                    startBuffered = i;
                    startBufferedId = id;
                    nextTop = top;
                }
                if (startNoBuffer !== null) {
                    if (top <= scrollBottom) {
                        endNoBuffer = i;
                    }
                    if (top <= scrollBottomBuffered) {
                        endBuffered = i;
                        nextBottom = top + size;
                    } else {
                        foundEnd = true;
                    }
                }
            }
        }

        const idsInView: string[] = [];
        for (let i = firstFullyOnScreenIndex!; i <= endNoBuffer!; i++) {
            const id = idCache.get(i) ?? getId(state, i)!;
            idsInView.push(id);
        }

        Object.assign(state, {
            startBuffered,
            startBufferedId,
            startNoBuffer,
            endBuffered,
            endNoBuffer,
            idsInView,
            firstFullyOnScreenIndex,
        });

        // Precompute the scroll that will be needed for the range to change
        // so it can be skipped if not needed
        if (enableScrollForNextCalculateItemsInView && nextTop !== undefined && nextBottom !== undefined) {
            state.scrollForNextCalculateItemsInView =
                nextTop !== undefined && nextBottom !== undefined
                    ? {
                          top: nextTop,
                          bottom: nextBottom,
                      }
                    : undefined;
        }

        // console.log(
        //     "start",
        // Math.round(scroll),
        // Math.round(scrollState),
        // Math.round(scrollExtra),
        //     Math.round(scrollAdjustPad),
        //     startBuffered,
        //     startNoBuffer,
        //     endNoBuffer,
        //     endBuffered,
        // );

        const numContainers = peek$(ctx, "numContainers");
        // Reset containers that aren't used anymore because the data has changed
        const pendingRemoval: number[] = [];
        if (dataChanged) {
            for (let i = 0; i < numContainers; i++) {
                const itemKey = peek$(ctx, `containerItemKey${i}`);
                if (!keyExtractorProp || (itemKey && indexByKey.get(itemKey) === undefined)) {
                    pendingRemoval.push(i);
                }
            }
        }

        if (startBuffered !== null && endBuffered !== null) {
            let numContainers = prevNumContainers;
            const needNewContainers: number[] = [];

            for (let i = startBuffered!; i <= endBuffered; i++) {
                const id = idCache.get(i) ?? getId(state, i)!;
                if (!containerItemKeys.has(id)) {
                    needNewContainers.push(i);
                }
            }

            if (needNewContainers.length > 0) {
                const availableContainers = findAvailableContainers(
                    needNewContainers.length,
                    startBuffered,
                    endBuffered,
                    pendingRemoval,
                );
                for (let idx = 0; idx < needNewContainers.length; idx++) {
                    const i = needNewContainers[idx];
                    const containerIndex = availableContainers[idx];
                    const id = idCache.get(i) ?? getId(state, i)!;

                    // Remove old key from cache
                    const oldKey = peek$(ctx, `containerItemKey${containerIndex}`);
                    if (oldKey && oldKey !== id) {
                        containerItemKeys!.delete(oldKey);
                    }

                    set$(ctx, `containerItemKey${containerIndex}`, id);
                    set$(ctx, `containerItemData${containerIndex}`, data[i]);

                    // Update cache when adding new item
                    containerItemKeys!.add(id);

                    if (containerIndex >= numContainers) {
                        numContainers = containerIndex + 1;
                    }
                }

                if (numContainers !== prevNumContainers) {
                    set$(ctx, "numContainers", numContainers);
                    if (numContainers > peek$(ctx, "numContainersPooled")) {
                        set$(ctx, "numContainersPooled", Math.ceil(numContainers * 1.5));
                    }
                }
            }

            // Update top positions of all containers
            for (let i = 0; i < numContainers; i++) {
                const itemKey = peek$(ctx, `containerItemKey${i}`);

                // If it was
                if (pendingRemoval.includes(i)) {
                    // Update cache when removing item
                    if (itemKey) {
                        containerItemKeys!.delete(itemKey);
                    }

                    set$(ctx, `containerItemKey${i}`, undefined);
                    set$(ctx, `containerItemData${i}`, undefined);
                    set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                    set$(ctx, `containerColumn${i}`, -1);
                } else {
                    const itemIndex = indexByKey.get(itemKey)!;
                    const item = data[itemIndex];
                    if (item !== undefined) {
                        const id = idCache.get(itemIndex) ?? getId(state, itemIndex);
                        const position = positions.get(id);

                        if (position === undefined) {
                            // This item may have been in view before data changed and positions were reset
                            // so we need to set it to out of view
                            set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                        } else {
                            const pos = positions.get(id)!;
                            const column = columns.get(id) || 1;

                            const prevPos = peek$(ctx, `containerPosition${i}`);
                            const prevColumn = peek$(ctx, `containerColumn${i}`);
                            const prevData = peek$(ctx, `containerItemData${i}`);

                            if (!prevPos || (pos > POSITION_OUT_OF_VIEW && pos !== prevPos)) {
                                set$(ctx, `containerPosition${i}`, pos);
                            }
                            if (column >= 0 && column !== prevColumn) {
                                set$(ctx, `containerColumn${i}`, column);
                            }

                            if (prevData !== item) {
                                set$(ctx, `containerItemData${i}`, data[itemIndex]);
                            }
                        }
                    }
                }
            }
        }

        if (!queuedInitialLayout && endBuffered !== null) {
            // If waiting for initial layout and all items in view have a known size then
            // initial layout is complete
            if (checkAllSizesKnown(state)) {
                setDidLayout();
            }
        }

        if (viewabilityConfigCallbackPairs) {
            updateViewableItems(state, ctx, viewabilityConfigCallbackPairs, scrollLength, startNoBuffer!, endNoBuffer!);
        }
    }, []);

    state.calculateItemsInView = calculateItemsInView;
    state.refScroller = refScroller;

    const setPaddingTop = ({
        stylePaddingTop,
        alignItemsPaddingTop,
    }: { stylePaddingTop?: number; alignItemsPaddingTop?: number }) => {
        if (stylePaddingTop !== undefined) {
            const prevStylePaddingTop = peek$(ctx, "stylePaddingTop") || 0;
            if (stylePaddingTop < prevStylePaddingTop) {
                // If reducing top padding then we need to make sure the ScrollView doesn't
                // scroll itself because the height reduced.
                // First add the padding to the total size so that the total height in the ScrollView
                // doesn't change
                const prevTotalSize = peek$(ctx, "totalSize") || 0;
                set$(ctx, "totalSize", prevTotalSize + prevStylePaddingTop);
                setTimeout(() => {
                    // Then reset it back to how it was
                    set$(ctx, "totalSize", prevTotalSize);
                }, 16);
            }

            // Now set the padding
            set$(ctx, "stylePaddingTop", stylePaddingTop);
        }
        if (alignItemsPaddingTop !== undefined) {
            set$(ctx, "alignItemsPaddingTop", alignItemsPaddingTop);
        }
    };

    const updateAlignItemsPaddingTop = () => {
        if (alignItemsAtEnd) {
            const { scrollLength } = refState.current!;
            const data = refState.current!.props.data;
            let alignItemsPaddingTop = 0;
            if (data?.length > 0) {
                const contentSize = getContentSize(ctx);
                alignItemsPaddingTop = Math.max(0, Math.floor(scrollLength - contentSize));
            }
            setPaddingTop({ alignItemsPaddingTop });
        }
    };

    const scrollTo = (
        params: {
            animated?: boolean;
            index?: number;
            offset: number;
            viewOffset?: number;
            viewPosition?: number;
        } = {} as any,
    ) => {
        const { animated } = params;

        const offset = calculateOffsetWithOffsetPosition(state, params.offset, params);

        // Disable scroll adjust while scrolling so that it doesn't do extra work affecting the target offset
        state.scrollHistory.length = 0;
        state.scrollingTo = params;
        state.scrollPending = offset;
        // Do the scroll
        refScroller.current?.scrollTo({
            x: horizontal ? offset : 0,
            y: horizontal ? 0 : offset,
            animated: !!animated,
        });

        if (!animated) {
            state.scroll = offset;
            // TODO: Should this not be a timeout, and instead wait for all item layouts to settle?
            // It's used for mvcp for when items change size above scroll.
            setTimeout(() => finishScrollTo(state), 100);
        }
    };

    const checkResetContainers = (isFirst: boolean) => {
        const state = refState.current;
        if (state) {
            state.props.data = dataProp;

            if (!isFirst) {
                calculateItemsInView({ dataChanged: true, doMVCP: true });

                const didMaintainScrollAtEnd = doMaintainScrollAtEnd(ctx, state, false);

                // Reset the endReached flag if new data has been added and we didn't
                // just maintain the scroll at end
                if (!didMaintainScrollAtEnd && dataProp.length > state.props.data.length) {
                    state.isEndReached = false;
                }

                if (!didMaintainScrollAtEnd) {
                    checkAtTop(state);
                    checkAtBottom(ctx, state);
                }
            }
        }
    };

    const findAvailableContainers = (
        numNeeded: number,
        startBuffered: number,
        endBuffered: number,
        pendingRemoval: number[],
    ): number[] => {
        const numContainers = peek$(ctx, "numContainers") as number;

        const result: number[] = [];
        const availableContainers: Array<{ index: number; distance: number }> = [];

        // First pass: collect unallocated containers (most efficient to use)
        for (let u = 0; u < numContainers; u++) {
            const key = peek$(ctx, `containerItemKey${u}`);
            let isOk = key === undefined;
            if (!isOk) {
                const index = pendingRemoval.indexOf(u);
                if (index !== -1) {
                    pendingRemoval.splice(index, 1);
                    isOk = true;
                }
            }
            // Hasn't been allocated yet or is pending removal, so use it
            if (isOk) {
                result.push(u);
                if (result.length >= numNeeded) {
                    return result; // Early exit if we have enough unallocated containers
                }
            }
        }

        // Second pass: collect containers that are out of view
        for (let u = 0; u < numContainers; u++) {
            const key = peek$(ctx, `containerItemKey${u}`);
            if (key === undefined) continue; // Skip already collected containers

            const index = state.indexByKey.get(key)!;
            if (index < startBuffered) {
                availableContainers.push({ index: u, distance: startBuffered - index });
            } else if (index > endBuffered) {
                availableContainers.push({ index: u, distance: index - endBuffered });
            }
        }

        // If we need more containers than we have available so far
        const remaining = numNeeded - result.length;
        if (remaining > 0) {
            if (availableContainers.length > 0) {
                // Only sort if we need to
                if (availableContainers.length > remaining) {
                    // Sort by distance (furthest first)
                    availableContainers.sort(comparatorByDistance);
                    // Take just what we need
                    availableContainers.length = remaining;
                }

                // Add to result, keeping track of original indices
                for (const container of availableContainers) {
                    result.push(container.index);
                }
            }

            // If we still need more, create new containers
            const stillNeeded = numNeeded - result.length;
            if (stillNeeded > 0) {
                for (let i = 0; i < stillNeeded; i++) {
                    result.push(numContainers + i);
                }

                if (__DEV__ && numContainers + stillNeeded > peek$(ctx, "numContainersPooled")) {
                    console.warn(
                        "[legend-list] No unused container available, so creating one on demand. This can be a minor performance issue and is likely caused by the estimatedItemSize being too large. Consider decreasing estimatedItemSize or increasing initialContainerPoolRatio.",
                        {
                            debugInfo: {
                                numContainers,
                                numNeeded,
                                stillNeeded,
                                numContainersPooled: peek$(ctx, "numContainersPooled"),
                            },
                        },
                    );
                }
            }
        }

        // Sort by index for consistent ordering
        return result.sort(comparatorDefault);
    };

    const isFirst = !refState.current.renderItem;

    const memoizedLastItemKeys = useMemo(() => {
        if (!dataProp.length) return [];
        return Array.from({ length: Math.min(numColumnsProp, dataProp.length) }, (_, i) =>
            getId(state, dataProp.length - 1 - i),
        );
    }, [dataProp, numColumnsProp]);

    // Run first time and whenever data changes
    const initalizeStateVars = () => {
        set$(ctx, "lastItemKeys", memoizedLastItemKeys);
        set$(ctx, "numColumns", numColumnsProp);

        // If the stylePaddingTop has changed, scroll to an adjusted offset to
        // keep the same content in view
        const prevPaddingTop = peek$(ctx, "stylePaddingTop");
        setPaddingTop({ stylePaddingTop: stylePaddingTopState });
        refState.current!.props.stylePaddingBottom = stylePaddingBottomState;

        const paddingDiff = stylePaddingTopState - prevPaddingTop;
        // If the style padding has changed then adjust the paddingTop and update scroll to compensate
        // Only iOS seems to need the scroll compensation
        if (paddingDiff && prevPaddingTop !== undefined && Platform.OS === "ios") {
            requestAdjust(ctx, state, paddingDiff);
        }
    };
    if (isFirst) {
        initalizeStateVars();
        updateAllPositions();
    }
    const initialContentOffset = useMemo(() => {
        const initialContentOffset = initialScrollOffset || calculateOffsetForIndex(ctx, state, initialScrollIndex);
        refState.current!.isStartReached =
            initialContentOffset < refState.current!.scrollLength * onStartReachedThreshold!;

        if (initialContentOffset > 0) {
            scrollTo({ offset: initialContentOffset, animated: false, index: initialScrollIndex });
        }

        return initialContentOffset;
    }, [renderNum]);

    if (isFirst || didDataChange || numColumnsProp !== peek$(ctx, "numColumns")) {
        refState.current.lastBatchingAction = Date.now();
        if (!keyExtractorProp && !isFirst && didDataChange) {
            __DEV__ &&
                warnDevOnce(
                    "keyExtractor",
                    "Changing data without a keyExtractor can cause slow performance and resetting scroll. If your list data can change you should use a keyExtractor with a unique id for best performance and behavior.",
                );
            // If we have no keyExtractor then we have no guarantees about previous item sizes so we have to reset
            refState.current.sizes.clear();
            refState.current.positions.clear();
        }
    }

    useLayoutEffect(() => {
        if (IsNewArchitecture) {
            const measured: { width: number; height: number } = (
                refScroller.current as any
            )?.unstable_getBoundingClientRect?.();
            if (measured) {
                const size = Math.floor(measured[horizontal ? "width" : "height"] * 8) / 8;

                if (size) {
                    handleLayout(measured);
                }
            }
        }
        if (!isFirst) {
            calculateItemsInView({ doMVCP: true });
        }
    }, [dataProp]);

    const onLayoutHeader = useCallback((rect: LayoutRectangle, fromLayoutEffect: boolean) => {
        const size = rect[horizontal ? "width" : "height"];
        set$(ctx, "headerSize", size);

        if (initialScroll) {
            if (IsNewArchitecture && Platform.OS !== "android") {
                if (fromLayoutEffect) {
                    setRenderNum((v) => v + 1);
                }
            } else {
                setTimeout(() => {
                    scrollToIndex({ ...initialScroll, animated: false });
                }, 17);
            }
        }
    }, []);

    useLayoutEffect(() => {
        const didAllocateContainers = doInitialAllocateContainers();
        if (!didAllocateContainers) {
            checkResetContainers(/*isFirst*/ isFirst);
        }
    }, [dataProp, numColumnsProp]);

    useLayoutEffect(() => {
        set$(ctx, "extraData", extraData);
    }, [extraData]);

    refState.current.renderItem = renderItem!;

    useLayoutEffect(initalizeStateVars, [
        memoizedLastItemKeys.join(","),
        numColumnsProp,
        stylePaddingTopState,
        stylePaddingBottomState,
    ]);

    const getRenderedItem = useCallback((key: string) => {
        const state = refState.current;
        if (!state) {
            return null;
        }

        const { indexByKey } = state;
        const data = state.props.data;

        const index = indexByKey.get(key);

        if (index === undefined) {
            return null;
        }

        const renderItemProp = refState.current!.renderItem;
        let renderedItem: React.ReactNode = null;

        if (renderItemProp) {
            const itemProps = {
                item: data[index],
                index,
                extraData: peek$(ctx, "extraData"),
            };

            renderedItem = React.createElement(renderItemProp, itemProps);
        }

        return { index, item: data[index], renderedItem };
    }, []);

    const doInitialAllocateContainers = () => {
        // Allocate containers
        const { scrollLength } = state;
        const data = state.props.data;
        if (scrollLength > 0 && data.length > 0 && !peek$(ctx, "numContainers")) {
            const averageItemSize = getEstimatedItemSize ? getEstimatedItemSize(0, data[0]) : estimatedItemSize;
            const Extra = 1.5; // TODO make it a prop, experiment with whether it's faster with more containers
            const numContainers = Math.ceil(
                ((scrollLength + scrollBuffer * 2) / averageItemSize) * numColumnsProp * Extra,
            );

            for (let i = 0; i < numContainers; i++) {
                set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                set$(ctx, `containerColumn${i}`, -1);
            }

            set$(ctx, "numContainers", numContainers);
            set$(ctx, "numContainersPooled", numContainers * initialContainerPoolRatio);

            if (!IsNewArchitecture) {
                if (initialScroll) {
                    requestAnimationFrame(() => {
                        // immediate render causes issues with initial index position
                        calculateItemsInView();
                    });
                } else {
                    calculateItemsInView();
                }
            }

            return true;
        }
    };

    useEffect(() => {
        const viewability = setupViewability({
            viewabilityConfig,
            viewabilityConfigCallbackPairs,
            onViewableItemsChanged,
        });
        state.viewabilityConfigCallbackPairs = viewability;
        state.enableScrollForNextCalculateItemsInView = !viewability;
    }, [viewabilityConfig, viewabilityConfigCallbackPairs, onViewableItemsChanged]);

    if (!IsNewArchitecture) {
        // Needs to use the initial estimated size on old arch, new arch will come within the useLayoutEffect
        useInit(() => {
            doInitialAllocateContainers();
        });
    }

    const handleLayout = useCallback((size: { width: number; height: number }) => {
        const scrollLength = size[horizontal ? "width" : "height"];
        const otherAxisSize = size[horizontal ? "height" : "width"];

        const didChange = scrollLength !== state.scrollLength;
        const prevOtherAxisSize = state.otherAxisSize;
        state.scrollLength = scrollLength;
        state.otherAxisSize = otherAxisSize;
        state.lastBatchingAction = Date.now();
        state.scrollForNextCalculateItemsInView = undefined;

        doInitialAllocateContainers();

        if (didChange) {
            calculateItemsInView({ doMVCP: true });
        }
        if (didChange || otherAxisSize !== prevOtherAxisSize) {
            set$(ctx, "scrollSize", { width: size.width, height: size.height });
        }

        doMaintainScrollAtEnd(ctx, state, false);
        updateAlignItemsPaddingTop();
        checkAtBottom(ctx, state);
        checkAtTop(state);

        if (refState.current) {
            // If otherAxisSize minus padding is less than 10, we need to set the size of the other axis
            // from the item height. 10 is just a magic number to account for border/outline or rounding errors.
            refState.current.needsOtherAxisSize = otherAxisSize - (stylePaddingTopState || 0) < 10;
        }

        if (__DEV__ && scrollLength === 0) {
            warnDevOnce(
                "height0",
                `List ${
                    horizontal ? "width" : "height"
                } is 0. You may need to set a style or \`flex: \` for the list, because children are absolutely positioned.`,
            );
        }

        calculateItemsInView({ doMVCP: true });

        setCanRender(true);
    }, []);

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        const layout = event.nativeEvent.layout;
        handleLayout(layout);

        if (onLayoutProp) {
            onLayoutProp(event);
        }
    }, []);

    const handleScroll = useCallback(
        (event: {
            nativeEvent: NativeScrollEvent;
        }) => {
            if (event.nativeEvent?.contentSize?.height === 0 && event.nativeEvent.contentSize?.width === 0) {
                return;
            }

            const newScroll = event.nativeEvent.contentOffset[horizontal ? "x" : "y"];

            // Ignore scroll events that are too close to the previous scroll position
            // after adjusting for MVCP
            const ignoreScrollFromMVCP = state.ignoreScrollFromMVCP;
            if (ignoreScrollFromMVCP && !state.scrollingTo) {
                const { lt, gt } = ignoreScrollFromMVCP;
                if ((lt && newScroll < lt) || (gt && newScroll > gt)) {
                    return;
                }
            }

            state.scrollPending = newScroll;

            updateScroll(newScroll);

            state.props.onScroll?.(event as NativeSyntheticEvent<NativeScrollEvent>);
        },
        [],
    );

    const updateScroll = useCallback((newScroll: number) => {
        const scrollingTo = state.scrollingTo;

        state.hasScrolled = true;
        state.lastBatchingAction = Date.now();
        const currentTime = performance.now();

        // Don't add to the history if it's initial scroll event otherwise invalid velocity will be calculated
        // Don't add to the history if we are scrolling to an offset
        if (scrollingTo === undefined && !(state.scrollHistory.length === 0 && newScroll === state.scroll)) {
            // Update scroll history
            state.scrollHistory.push({ scroll: newScroll, time: currentTime });
        }

        // Keep only last 5 entries
        if (state.scrollHistory.length > 5) {
            state.scrollHistory.shift();
        }

        // Update current scroll state
        state.scrollPrev = state.scroll;
        state.scrollPrevTime = state.scrollTime;
        state.scroll = newScroll;
        state.scrollTime = currentTime;
        // Use velocity to predict scroll position
        calculateItemsInView();
        checkAtBottom(ctx, state);
        checkAtTop(state);
    }, []);

    useImperativeHandle(
        forwardedRef,
        () => {
            const scrollIndexIntoView = (options: Parameters<LegendListRef["scrollIndexIntoView"]>[0]) => {
                const state = refState.current;
                if (state) {
                    const { index, ...rest } = options;
                    const { startNoBuffer, endNoBuffer } = state;
                    if (index < startNoBuffer || index > endNoBuffer) {
                        const viewPosition = index < startNoBuffer ? 0 : 1;
                        scrollToIndex({
                            ...rest,
                            viewPosition,
                            index,
                        });
                    }
                }
            };
            return {
                flashScrollIndicators: () => refScroller.current!.flashScrollIndicators(),
                getNativeScrollRef: () => refScroller.current!,
                getScrollableNode: () => refScroller.current!.getScrollableNode(),
                getScrollResponder: () => refScroller.current!.getScrollResponder(),
                getState: () => {
                    const state = refState.current;
                    return state
                        ? {
                              contentLength: state.totalSize,
                              end: state.endNoBuffer,
                              endBuffered: state.endBuffered,
                              isAtEnd: state.isAtEnd,
                              isAtStart: state.isAtStart,
                              scroll: state.scroll,
                              scrollLength: state.scrollLength,
                              start: state.startNoBuffer,
                              startBuffered: state.startBuffered,
                              sizes: state.sizesKnown,
                              sizeAtIndex: (index: number) => state.sizesKnown.get(getId(state, index))!,
                          }
                        : ({} as ScrollState);
                },
                scrollIndexIntoView,
                scrollItemIntoView: ({ item, ...props }) => {
                    const data = refState.current!.props.data;
                    const index = data.indexOf(item);
                    if (index !== -1) {
                        scrollIndexIntoView({ index, ...props });
                    }
                },
                scrollToIndex,
                scrollToItem: ({ item, ...props }) => {
                    const data = refState.current!.props.data;
                    const index = data.indexOf(item);
                    if (index !== -1) {
                        scrollToIndex({ index, ...props });
                    }
                },
                scrollToOffset: (params) => scrollTo(params),
                scrollToEnd: (options) => {
                    const data = refState.current!.props.data;
                    const stylePaddingBottom = refState.current!.props.stylePaddingBottom;
                    const index = data.length - 1;
                    if (index !== -1) {
                        const paddingBottom = stylePaddingBottom || 0;
                        const footerSize = peek$(ctx, "footerSize") || 0;
                        scrollToIndex({
                            index,
                            viewPosition: 1,
                            viewOffset: -paddingBottom - footerSize,
                            ...options,
                        });
                    }
                },
                setVisibleContentAnchorOffset: (value: number | ((value: number) => number)) => {
                    const val = typeof value === "function" ? value(peek$(ctx, "scrollAdjustUserOffset") || 0) : value;
                    set$(ctx, "scrollAdjustUserOffset", val);
                },
            };
        },
        [],
    );

    if (Platform.OS === "web") {
        useEffect(() => {
            if (initialContentOffset) {
                scrollTo({ offset: initialContentOffset, animated: false });
            }
        }, []);
    }

    const updateItemSizeCallback = useCallback((itemKey: string, sizeObj: { width: number; height: number }) => {
        updateItemSize(ctx, state, itemKey, sizeObj);
    }, []);

    return (
        <>
            <ListComponent
                {...rest}
                canRender={canRender}
                horizontal={horizontal!}
                refScrollView={combinedRef}
                initialContentOffset={initialContentOffset}
                getRenderedItem={getRenderedItem}
                updateItemSize={updateItemSizeCallback}
                handleScroll={handleScroll}
                onMomentumScrollEnd={(event) => {
                    requestAnimationFrame(() => {
                        finishScrollTo(refState.current);
                    });

                    if (onMomentumScrollEnd) {
                        onMomentumScrollEnd(event);
                    }
                }}
                onLayout={onLayout}
                recycleItems={recycleItems}
                alignItemsAtEnd={alignItemsAtEnd}
                ListEmptyComponent={dataProp.length === 0 ? ListEmptyComponent : undefined}
                ListHeaderComponent={ListHeaderComponent}
                maintainVisibleContentPosition={maintainVisibleContentPosition}
                scrollEventThrottle={Platform.OS === "web" ? 16 : undefined}
                waitForInitialLayout={waitForInitialLayout}
                refreshControl={
                    refreshControl
                        ? stylePaddingTopState > 0
                            ? React.cloneElement(refreshControl, {
                                  progressViewOffset:
                                      (refreshControl.props.progressViewOffset || 0) + stylePaddingTopState,
                              })
                            : refreshControl
                        : onRefresh && (
                              <RefreshControl
                                  refreshing={!!refreshing}
                                  onRefresh={onRefresh}
                                  progressViewOffset={(progressViewOffset || 0) + stylePaddingTopState}
                              />
                          )
                }
                style={style}
                contentContainerStyle={contentContainerStyle}
                scrollAdjustHandler={refState.current?.scrollAdjustHandler}
                onLayoutHeader={onLayoutHeader}
            />
            {__DEV__ && ENABLE_DEBUG_VIEW && <DebugView state={refState.current!} />}
        </>
    );
});
