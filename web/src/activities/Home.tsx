import { AppScreen } from "@stackflow/plugin-basic-ui";
import type { ActivityComponentType } from "@stackflow/react";
import { vars } from "../styles/theme.css";
import * as styles from "./Home.css";

export const Home: ActivityComponentType<"Home"> = () => (
  <AppScreen backgroundColor={vars.color.background}>
    <main className={styles.page}>
      <h1 className={styles.title}>뭔말이야</h1>
      <p className={styles.description}>요즘 말, 10문제로 확인하기</p>
      <button type="button" className={styles.startButton}>
        시작
      </button>
    </main>
  </AppScreen>
);
