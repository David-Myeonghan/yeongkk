import { View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";

export default function AdBanner(props: { unitId: string; nonPersonalized: boolean }) {
  return (
    <View style={{ alignItems: "center" }}>
      <BannerAd
        key={props.nonPersonalized ? "npa" : "pa"}
        unitId={props.unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: props.nonPersonalized }}
      />
    </View>
  );
}
