import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { Colors } from '@constants/colors';

const AnimatedGroup = Animated.createAnimatedComponent(G);

interface RescueMascotProps {
  size?: number;
  animated?: boolean;
}

export default function RescueMascot({ size = 48, animated = false }: RescueMascotProps) {
  const bounce = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const tailWag = useRef(new Animated.Value(0)).current;
  const armWave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return undefined;

    const bounceLoop = Animated.loop(Animated.sequence([
      Animated.timing(bounce, { toValue: -3, duration: 720, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 0, duration: 720, useNativeDriver: true }),
    ]));
    const swayLoop = Animated.loop(Animated.sequence([
      Animated.timing(sway, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(sway, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    const tailLoop = Animated.loop(Animated.sequence([
      Animated.timing(tailWag, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(tailWag, { toValue: 0, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));
    const armLoop = Animated.loop(Animated.sequence([
      Animated.timing(armWave, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(armWave, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));

    bounceLoop.start();
    swayLoop.start();
    tailLoop.start();
    armLoop.start();

    return () => {
      bounceLoop.stop();
      swayLoop.stop();
      tailLoop.stop();
      armLoop.stop();
    };
  }, [animated, armWave, bounce, sway, tailWag]);

  const tailRotation = tailWag.interpolate({ inputRange: [0, 1], outputRange: [-8, 12] });
  const armRotation = armWave.interpolate({ inputRange: [0, 1], outputRange: [-8, 9] });

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Kaya, the HANDA rescue dog mascot"
      style={[
        styles.container,
        { width: size, height: size * (190 / 180) },
        animated && {
          transform: [
            { translateY: bounce },
            { rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] }) },
          ],
        },
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 180 190">
        <Circle cx="90" cy="96" r="85" fill="#FFF1F6" />
        <Circle cx="145" cy="37" r="13" fill="#E7F3FA" />
        <Circle cx="33" cy="74" r="5" fill={Colors.brandBlue} />
        <AnimatedGroup rotation={tailRotation} originX={47} originY={135}>
          <Path d="M47 135 C26 147 27 121 37 116 C45 112 48 124 43 128" fill="none" stroke="#B77B56" strokeWidth="9" strokeLinecap="round" />
        </AnimatedGroup>
        <Path d="M54 110 C60 99 72 94 90 94 C108 94 121 100 127 113 L138 174 H42 L48 126 Z" fill="#F2D2AE" />
        <Path d="M56 116 C68 108 78 106 90 106 C103 106 114 109 124 117 L133 171 H47 Z" fill={Colors.brandPink} />
        <Path d="M83 108 H98 L105 171 H76 Z" fill={Colors.brandBlue} />
        <AnimatedGroup rotation={armRotation} originX={119} originY={119}>
          <Path d="M119 119 C130 110 135 94 143 84" fill="none" stroke="#E8C092" strokeWidth="13" strokeLinecap="round" />
          <Circle cx="146" cy="78" r="10" fill="#E8C092" />
        </AnimatedGroup>
        <Path d="M43 120 C49 115 56 114 62 117 L67 131 C60 137 52 137 46 131 Z" fill="#E8C092" />
        <Path d="M64 172 L61 182 H80 L82 172 M99 172 L101 182 H120 L117 171" fill="#A96756" />
        <Ellipse cx="53" cy="58" rx="14" ry="25" transform="rotate(-27 53 58)" fill="#A96756" />
        <Ellipse cx="127" cy="58" rx="14" ry="25" transform="rotate(27 127 58)" fill="#A96756" />
        <Ellipse cx="90" cy="62" rx="43" ry="40" fill="#EBC99E" />
        <Ellipse cx="73" cy="71" rx="4" ry="5" fill="#3B302B" />
        <Ellipse cx="107" cy="71" rx="4" ry="5" fill="#3B302B" />
        <Ellipse cx="90" cy="84" rx="17" ry="12" fill="#FFF8F0" />
        <Path d="M85 80 C86 75 94 75 95 80 C95 84 92 85 90 85 C88 85 85 84 85 80 Z" fill="#513D39" />
        <Path d="M90 85 C90 91 83 92 80 88 M90 85 C90 91 97 92 100 88" fill="none" stroke="#76544D" strokeWidth="2" strokeLinecap="round" />
        <Path d="M46 49 C47 27 64 16 90 16 C116 16 133 27 134 49 L123 46 C119 38 107 34 90 34 C73 34 61 38 57 46 Z" fill={Colors.brandBlue} />
        <Path d="M49 47 C67 39 113 39 131 47 L128 54 C110 49 70 49 52 55 Z" fill={Colors.primary} />
        <Path d="M76 37 L90 30 L104 37 L101 50 L90 57 L79 50 Z" fill="#FFFFFF" />
        <Path d="M88 37 H92 V41 H96 V45 H92 V49 H88 V45 H84 V41 H88 Z" fill={Colors.primary} />
        <Path d="M78 127 L90 135 L102 127 L106 143 L90 153 L74 143 Z" fill="#FFFFFF" />
        <Path d="M88 134 H92 V138 H96 V142 H92 V146 H88 V142 H84 V138 H88 Z" fill={Colors.brandBlueDeep} />
        <Circle cx="39" cy="47" r="3" fill={Colors.brandBlue} />
        <Path d="M135 124 L138 131 L145 134 L138 137 L135 144 L132 137 L125 134 L132 131 Z" fill={Colors.brandBlue} />
        <Rect x="52" y="185" width="76" height="3" rx="1.5" fill="#DCEAF2" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
