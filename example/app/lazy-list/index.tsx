import { useRef, useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";

import { LazyLegendList, type LegendListRef } from "@legendapp/list";
import { countries, getEmojiFlag, type TCountryCode } from "countries-list";

type Country = {
    id: string;
    name: string;
    flag: string;
};

const DATA: Country[] = Object.entries(countries)
    .map(([code, country]) => ({
        id: code,
        name: country.name,
        flag: getEmojiFlag(code as TCountryCode),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

export default function LazyList() {
    const listRef = useRef<LegendListRef>(null);
    const [selectedId, setSelectedId] = useState<string>();

    return (
        <View style={styles.container}>
            <LazyLegendList ref={listRef} maintainVisibleContentPosition recycleItems>
                <View style={styles.heading}>
                    <Text style={styles.headingText}>Countries lazy scrollview</Text>
                </View>
                {DATA.map((country) => (
                    <Pressable
                        key={country.id}
                        onPress={() => setSelectedId(country.id)}
                        style={({ pressed }) => [
                            styles.item,
                            selectedId === country.id && styles.selectedItem,
                            pressed && styles.pressedItem,
                        ]}
                    >
                        <View style={styles.flagContainer}>
                            <Text style={styles.flag}>{country.flag}</Text>
                        </View>
                        <View style={styles.contentContainer}>
                            <Text style={[styles.title, selectedId === country.id && styles.selectedText]}>
                                {country.name}
                                <Text style={styles.countryCode}> ({country.id})</Text>
                            </Text>
                        </View>
                    </Pressable>
                ))}
            </LazyLegendList>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: StatusBar.currentHeight || 0,
        backgroundColor: "#f5f5f5",
    },
    heading: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    headingText: {
        fontWeight: "bold",
    },
    item: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
        //     shadowColor: "#000",
        //     shadowOffset: {
        //         width: 0,
        //         height: 2,
        //     },
        //     shadowOpacity: 0.1,
        //     shadowRadius: 3,
        //     elevation: 3,
    },
    selectedItem: {
        // backgroundColor: "#e3f2fd",
        // borderColor: "#1976d2",
        // borderWidth: 1,
    },
    pressedItem: {
        // backgroundColor: "#f0f0f0",
    },
    flagContainer: {
        marginRight: 16,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#f8f9fa",
        alignItems: "center",
        justifyContent: "center",
    },
    flag: {
        fontSize: 28,
    },
    contentContainer: {
        flex: 1,
        justifyContent: "center",
    },
    title: {
        fontSize: 16,
        color: "#333",
        fontWeight: "500",
    },
    selectedText: {
        color: "#1976d2",
        fontWeight: "600",
    },
    countryCode: {
        fontSize: 14,
        color: "#666",
        fontWeight: "400",
    },
});
