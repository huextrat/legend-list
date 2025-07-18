import { Fragment, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import renderItem from "~/app/cards-renderItem";
import { DO_SCROLL_TEST, DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH, RECYCLE_ITEMS } from "~/constants/constants";
import { useScrollTest } from "~/constants/useScrollTest";

export default function HomeScreen() {
    const data = Array.from({ length: 1000 }, (_, i) => ({ id: i.toString() }));

    const scrollRef = useRef<FlashList<any>>(null);

    //   useEffect(() => {
    //     let amtPerInterval = 4;
    //     let index = amtPerInterval;
    //     const interval = setInterval(() => {
    //       scrollRef.current?.scrollToIndex({
    //         index,
    //       });
    //       index += amtPerInterval;
    //     }, 100);

    //     return () => clearInterval(interval);
    //   });

    const renderItemFn = (info: ListRenderItemInfo<any>) => {
        return RECYCLE_ITEMS ? renderItem(info) : <Fragment key={info.item.id}>{renderItem(info)}</Fragment>;
    };

    if (DO_SCROLL_TEST) {
        useScrollTest((offset) => {
            scrollRef.current?.scrollToOffset({
                animated: true,
                offset,
            });
        });
    }

    return (
        <View key="flashlist" style={[StyleSheet.absoluteFill, styles.outerContainer]}>
            <FlashList
                contentContainerStyle={styles.listContainer}
                data={data}
                drawDistance={DRAW_DISTANCE}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={<View />}
                ListHeaderComponentStyle={styles.listHeader}
                ref={scrollRef}
                renderItem={renderItemFn}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    footerText: {
        color: "#888888",
        fontSize: 14,
    },
    itemBody: {
        color: "#666666",
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    itemContainer: {
        // padding: 4,
        // borderBottomWidth: 1,
        // borderBottomColor: "#ccc",
    },
    itemFooter: {
        borderTopColor: "#f0f0f0",
        borderTopWidth: 1,
        flexDirection: "row",
        gap: 16,
        justifyContent: "flex-start",
        marginTop: 12,
        paddingTop: 12,
    },
    itemTitle: {
        color: "#1a1a1a",
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 8,
    },
    listContainer: {
        //paddingHorizontal: 16,
        //paddingTop: 48,
    },
    listHeader: {
        alignSelf: "center",
        backgroundColor: "#456AAA",
        borderRadius: 12,
        height: 100,
        marginHorizontal: 8,
        marginTop: 8,
        width: 100,
    },
    outerContainer: {
        backgroundColor: "#456",
    },
    reactLogo: {
        bottom: 0,
        height: 178,
        left: 0,
        position: "absolute",
        width: 290,
    },
    scrollContainer: {
        // paddingHorizontal: 8,
    },
    stepContainer: {
        gap: 8,
        marginBottom: 8,
    },
    titleContainer: {
        alignItems: "center",
        flexDirection: "row",
        gap: 8,
    },
});
