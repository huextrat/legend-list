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
    Animated,
    Dimensions,
    type LayoutChangeEvent,
    type LayoutRectangle,
    type NativeScrollEvent,
    Platform,
    RefreshControl,
    type ScrollView,
    StyleSheet,
    type View,
} from "react-native";

import { DebugView } from "@/components/DebugView";
import { ListComponent } from "@/components/ListComponent";
import { ENABLE_DEBUG_VIEW, IsNewArchitecture } from "@/constants";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { doInitialAllocateContainers } from "@/core/doInitialAllocateContainers";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { finishScrollTo } from "@/core/finishScrollTo";
import { handleLayout } from "@/core/handleLayout";
import { onScroll } from "@/core/onScroll";
import { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { scrollTo } from "@/core/scrollTo";
import { scrollToIndex } from "@/core/scrollToIndex";
import { updateAllPositions } from "@/core/updateAllPositions";
import { updateItemSize } from "@/core/updateItemSize";
import { setupViewability } from "@/core/viewability";
import { useCombinedRef } from "@/hooks/useCombinedRef";
import { useInit } from "@/hooks/useInit";
import { peek$, StateProvider, set$, useStateContext } from "@/state/state";
import type {
    InternalState,
    LegendListProps,
    LegendListRef,
    MaintainScrollAtEndOptions,
    ScrollIndexWithOffsetPosition,
    ScrollState,
} from "@/types";
import { typedForwardRef } from "@/types";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { checkAtTop } from "@/utils/checkAtTop";
import { createColumnWrapperStyle } from "@/utils/createColumnWrapperStyle";
import { getId } from "@/utils/getId";
import { getRenderedItem } from "@/utils/getRenderedItem";
import { extractPadding, warnDevOnce } from "@/utils/helpers";
import { requestAdjust } from "@/utils/requestAdjust";
import { setPaddingTop } from "@/utils/setPaddingTop";
import { updateSnapToOffsets } from "@/utils/updateSnapToOffsets";

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
        alignItemsAtEnd = false,
        columnWrapperStyle,
        contentContainerStyle: contentContainerStyleProp,
        data: dataProp = [],
        drawDistance = 250,
        estimatedItemSize: estimatedItemSizeProp,
        estimatedListSize,
        extraData,
        getEstimatedItemSize,
        getFixedItemSize,
        getItemType,
        horizontal,
        initialContainerPoolRatio = 2,
        initialScrollIndex: initialScrollIndexProp,
        initialScrollOffset,
        keyExtractor: keyExtractorProp,
        ListEmptyComponent,
        ListHeaderComponent,
        maintainScrollAtEnd = false,
        maintainScrollAtEndThreshold = 0.1,
        maintainVisibleContentPosition = false,
        numColumns: numColumnsProp = 1,
        onEndReached,
        onEndReachedThreshold = 0.5,
        onItemSizeChanged,
        onLayout: onLayoutProp,
        onLoad,
        onMomentumScrollEnd,
        onRefresh,
        onScroll: onScrollProp,
        onStartReached,
        onStartReachedThreshold = 0.5,
        onViewableItemsChanged,
        progressViewOffset,
        recycleItems = false,
        refreshControl,
        refreshing,
        refScrollView,
        renderItem,
        snapToIndices,
        stickyIndices,
        style: styleProp,
        suggestEstimatedItemSize,
        viewabilityConfig,
        viewabilityConfigCallbackPairs,
        waitForInitialLayout = true,
        ...rest
    } = props;

    const [renderNum, setRenderNum] = useState(0);
    const initialScroll: ScrollIndexWithOffsetPosition | undefined =
        typeof initialScrollIndexProp === "number" ? { index: initialScrollIndexProp } : initialScrollIndexProp;
    const initialScrollIndex = initialScroll?.index;

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
    const keyExtractor = keyExtractorProp ?? ((_item, index) => index.toString());

    const refState = useRef<InternalState>();

    if (!refState.current) {
        const initialScrollLength = (estimatedListSize ??
            (IsNewArchitecture ? { height: 0, width: 0 } : Dimensions.get("window")))[horizontal ? "width" : "height"];

        refState.current = {
            activeStickyIndex: undefined,
            averageSizes: {},
            columns: new Map(),
            containerItemKeys: new Set(),
            containerItemTypes: new Map(),
            enableScrollForNextCalculateItemsInView: true,
            endBuffered: -1,
            endNoBuffer: -1,
            endReachedBlockedByTimer: false,
            firstFullyOnScreenIndex: -1,
            idCache: new Map(),
            idsInView: [],
            indexByKey: new Map(),
            initialScroll,
            isAtEnd: false,
            isAtStart: false,
            isEndReached: false,
            isStartReached: false,
            lastBatchingAction: Date.now(),
            lastLayout: undefined,
            loadStartTime: Date.now(),
            minIndexSizeChanged: 0,
            nativeMarginTop: 0,
            pendingAdjust: 0,
            positions: new Map(),
            props: {} as any,
            queuedCalculateItemsInView: 0,
            queuedItemSizeUpdates: [] as { itemKey: string; sizeObj: { width: number; height: number } }[],
            refScroller: undefined as any,
            scroll: 0,
            scrollAdjustHandler: new ScrollAdjustHandler(ctx),
            scrollForNextCalculateItemsInView: undefined,
            scrollHistory: [],
            scrollLength: initialScrollLength,
            scrollPending: 0,
            scrollPrev: 0,
            scrollPrevTime: 0,
            scrollTime: 0,
            sizes: new Map(),
            sizesKnown: new Map(),
            startBuffered: -1,
            startNoBuffer: -1,
            startReachedBlockedByTimer: false,
            stickyContainerPool: new Set(),
            stickyContainers: new Map(),
            timeoutSizeMessage: 0,
            timeouts: new Set(),
            totalSize: 0,
            viewabilityConfigCallbackPairs: undefined as never,
        };

        set$(ctx, "maintainVisibleContentPosition", maintainVisibleContentPosition);
        set$(ctx, "extraData", extraData);
    }

    const state = refState.current!;

    const isFirst = !state.props.renderItem;

    const didDataChange = state.props.data !== dataProp;
    state.props = {
        alignItemsAtEnd,
        data: dataProp,
        estimatedItemSize,
        getEstimatedItemSize,
        getFixedItemSize,
        getItemType,
        horizontal: !!horizontal,
        initialContainerPoolRatio,
        initialScroll,
        keyExtractor,
        maintainScrollAtEnd,
        maintainScrollAtEndThreshold,
        maintainVisibleContentPosition,
        numColumns: numColumnsProp,
        onEndReached,
        onEndReachedThreshold,
        onItemSizeChanged,
        onLoad,
        onScroll: onScrollProp,
        onStartReached,
        onStartReachedThreshold,
        recycleItems: !!recycleItems,
        renderItem: renderItem!,
        scrollBuffer,
        snapToIndices,
        stickyIndicesArr: stickyIndices ?? [],
        stickyIndicesSet: useMemo(() => new Set(stickyIndices), [stickyIndices]),
        stylePaddingBottom: stylePaddingBottomState,
        stylePaddingTop: stylePaddingTopState,
        suggestEstimatedItemSize: !!suggestEstimatedItemSize,
    };

    state.refScroller = refScroller;

    const checkResetContainers = (isFirst: boolean) => {
        const state = refState.current;
        if (state) {
            state.props.data = dataProp;

            if (!isFirst) {
                calculateItemsInView(ctx, state, { dataChanged: true, doMVCP: true });

                const shouldMaintainScrollAtEnd =
                    maintainScrollAtEnd === true || (maintainScrollAtEnd as MaintainScrollAtEndOptions).onDataChange;

                const didMaintainScrollAtEnd = shouldMaintainScrollAtEnd && doMaintainScrollAtEnd(ctx, state, false);

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

    const memoizedLastItemKeys = useMemo(() => {
        if (!dataProp.length) return [];
        return Array.from({ length: Math.min(numColumnsProp, dataProp.length) }, (_, i) =>
            getId(state, dataProp.length - 1 - i),
        );
    }, [dataProp, numColumnsProp]);

    // Run first time and whenever data changes
    const initializeStateVars = () => {
        set$(ctx, "lastItemKeys", memoizedLastItemKeys);
        set$(ctx, "numColumns", numColumnsProp);

        // If the stylePaddingTop has changed, scroll to an adjusted offset to
        // keep the same content in view
        const prevPaddingTop = peek$(ctx, "stylePaddingTop");
        setPaddingTop(ctx, state, { stylePaddingTop: stylePaddingTopState });
        refState.current!.props.stylePaddingBottom = stylePaddingBottomState;

        let paddingDiff = stylePaddingTopState - prevPaddingTop;
        // If the style padding has changed then adjust the paddingTop and update scroll to compensate
        // Only iOS seems to need the scroll compensation
        if (maintainVisibleContentPosition && paddingDiff && prevPaddingTop !== undefined && Platform.OS === "ios") {
            // Scroll can be negative if being animated and that can break the pendingDiff
            if (state.scroll < 0) {
                paddingDiff += state.scroll;
            }
            requestAdjust(ctx, state, paddingDiff);
        }
    };

    if (isFirst) {
        initializeStateVars();
        updateAllPositions(ctx, state);
    }
    const initialContentOffset = useMemo(() => {
        const initialContentOffset = initialScrollOffset || calculateOffsetForIndex(ctx, state, initialScrollIndex);
        refState.current!.isStartReached =
            initialContentOffset < refState.current!.scrollLength * onStartReachedThreshold!;

        if (initialContentOffset > 0) {
            scrollTo(state, { animated: false, index: initialScrollIndex, offset: initialContentOffset });
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
            let measured: LayoutRectangle;
            (refScroller.current as unknown as View).measure((x, y, width, height) => {
                measured = { height, width, x, y };
            });
            if (measured!) {
                const size = Math.floor(measured[horizontal ? "width" : "height"] * 8) / 8;

                if (size) {
                    handleLayout(ctx, state, measured, setCanRender);
                }
            }
        }
        if (!isFirst) {
            calculateItemsInView(ctx, state, { doMVCP: true });
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
                    scrollToIndex(ctx, state, { ...initialScroll, animated: false });
                }, 17);
            }
        }
    }, []);

    useLayoutEffect(() => {
        if (snapToIndices) {
            updateSnapToOffsets(ctx, state);
        }
    }, [snapToIndices]);
    useLayoutEffect(() => {
        const didAllocateContainers = doInitialAllocateContainersCallback();
        if (!didAllocateContainers) {
            checkResetContainers(/*isFirst*/ isFirst);
        }
    }, [dataProp, numColumnsProp]);

    useLayoutEffect(() => {
        set$(ctx, "extraData", extraData);
    }, [extraData]);

    useLayoutEffect(initializeStateVars, [
        memoizedLastItemKeys.join(","),
        numColumnsProp,
        stylePaddingTopState,
        stylePaddingBottomState,
    ]);

    const doInitialAllocateContainersCallback = () => {
        return doInitialAllocateContainers(ctx, state);
    };

    useEffect(() => {
        const viewability = setupViewability({
            onViewableItemsChanged,
            viewabilityConfig,
            viewabilityConfigCallbackPairs,
        });
        state.viewabilityConfigCallbackPairs = viewability;
        state.enableScrollForNextCalculateItemsInView = !viewability;
    }, [viewabilityConfig, viewabilityConfigCallbackPairs, onViewableItemsChanged]);

    if (!IsNewArchitecture) {
        // Needs to use the initial estimated size on old arch, new arch will come within the useLayoutEffect
        useInit(() => {
            doInitialAllocateContainersCallback();
        });
    }

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        const layout = event.nativeEvent.layout;
        handleLayout(ctx, state, layout, setCanRender);

        if (onLayoutProp) {
            onLayoutProp(event);
        }
    }, []);

    useImperativeHandle(forwardedRef, () => {
        const scrollIndexIntoView = (options: Parameters<LegendListRef["scrollIndexIntoView"]>[0]) => {
            const state = refState.current;
            if (state) {
                const { index, ...rest } = options;
                const { startNoBuffer, endNoBuffer } = state;
                if (index < startNoBuffer || index > endNoBuffer) {
                    const viewPosition = index < startNoBuffer ? 0 : 1;
                    scrollToIndex(ctx, state, {
                        ...rest,
                        index,
                        viewPosition,
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
                          positions: state.positions,
                          scroll: state.scroll,
                          scrollLength: state.scrollLength,
                          sizeAtIndex: (index: number) => state.sizesKnown.get(getId(state, index))!,
                          sizes: state.sizesKnown,
                          start: state.startNoBuffer,
                          startBuffered: state.startBuffered,
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
            scrollToEnd: (options) => {
                const data = refState.current!.props.data;
                const stylePaddingBottom = refState.current!.props.stylePaddingBottom;
                const index = data.length - 1;
                if (index !== -1) {
                    const paddingBottom = stylePaddingBottom || 0;
                    const footerSize = peek$(ctx, "footerSize") || 0;
                    scrollToIndex(ctx, state, {
                        index,
                        viewOffset: -paddingBottom - footerSize + (options?.viewOffset || 0),
                        viewPosition: 1,
                        ...options,
                    });
                }
            },
            scrollToIndex: (params) => scrollToIndex(ctx, state, params),
            scrollToItem: ({ item, ...props }) => {
                const data = refState.current!.props.data;
                const index = data.indexOf(item);
                if (index !== -1) {
                    scrollToIndex(ctx, state, { index, ...props });
                }
            },
            scrollToOffset: (params) => scrollTo(state, params),
            setVisibleContentAnchorOffset: (value: number | ((value: number) => number)) => {
                const val = typeof value === "function" ? value(peek$(ctx, "scrollAdjustUserOffset") || 0) : value;
                set$(ctx, "scrollAdjustUserOffset", val);
            },
        };
    }, []);

    if (Platform.OS === "web") {
        useEffect(() => {
            if (initialContentOffset) {
                scrollTo(state, { animated: false, offset: initialContentOffset });
            }
        }, []);
    }

    const fns = useMemo(
        () => ({
            getRenderedItem: (key: string) => getRenderedItem(ctx, state, key),
            onScroll: (event: { nativeEvent: NativeScrollEvent }) => onScroll(ctx, state, event),
            updateItemSize: (itemKey: string, sizeObj: { width: number; height: number }) =>
                updateItemSize(ctx, state, itemKey, sizeObj),
        }),
        [],
    );

    // Create dual scroll handlers - one for native animations, one for JS logic
    const animatedScrollHandler = useMemo<typeof fns.onScroll>(() => {
        if (stickyIndices?.length) {
            const { animatedScrollY } = ctx;
            return Animated.event([{ nativeEvent: { contentOffset: { [horizontal ? "x" : "y"]: animatedScrollY } } }], {
                listener: fns.onScroll,
                useNativeDriver: true,
            });
        }
        return fns.onScroll;
    }, [stickyIndices, horizontal, onScroll]);

    return (
        <>
            <ListComponent
                {...rest}
                alignItemsAtEnd={alignItemsAtEnd}
                canRender={canRender}
                contentContainerStyle={contentContainerStyle}
                getRenderedItem={fns.getRenderedItem}
                horizontal={horizontal!}
                initialContentOffset={initialContentOffset}
                ListEmptyComponent={dataProp.length === 0 ? ListEmptyComponent : undefined}
                ListHeaderComponent={ListHeaderComponent}
                maintainVisibleContentPosition={maintainVisibleContentPosition}
                onLayout={onLayout}
                onLayoutHeader={onLayoutHeader}
                onMomentumScrollEnd={(event) => {
                    if (IsNewArchitecture) {
                        requestAnimationFrame(() => {
                            finishScrollTo(refState.current);
                        });
                    } else {
                        // TODO: This is a hack to fix an issue where items rendered while scrolling take a while to layout.
                        // This should ideally wait until all layouts have settled.
                        setTimeout(() => {
                            finishScrollTo(refState.current);
                        }, 1000);
                    }

                    if (onMomentumScrollEnd) {
                        onMomentumScrollEnd(event);
                    }
                }}
                onScroll={animatedScrollHandler}
                recycleItems={recycleItems}
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
                                  onRefresh={onRefresh}
                                  progressViewOffset={(progressViewOffset || 0) + stylePaddingTopState}
                                  refreshing={!!refreshing}
                              />
                          )
                }
                refScrollView={combinedRef}
                scrollAdjustHandler={refState.current?.scrollAdjustHandler}
                scrollEventThrottle={Platform.OS === "web" ? 16 : undefined}
                snapToIndices={snapToIndices}
                stickyIndices={stickyIndices}
                style={style}
                updateItemSize={fns.updateItemSize}
                waitForInitialLayout={waitForInitialLayout}
            />
            {__DEV__ && ENABLE_DEBUG_VIEW && <DebugView state={refState.current!} />}
        </>
    );
});
