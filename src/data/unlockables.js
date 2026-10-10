import unlockablesData from "./unlockables.json"
import taintedUnlockablesData from "./tainted-unlockables.json"
import { getResourceSlug } from "../utils/resource-slug"

const bossIcons = import.meta.glob("../assets/bosses/*.png", {
  eager: true,
  import: "default",
  query: "?url",
})

const rewardIcons = import.meta.glob("../assets/unlockables/**/*.jpg", {
  eager: true,
  import: "default",
  query: "?url",
})

const bossDisplayOrder = [
  "moms-heart",
  "ultra-greed",
  "ultra-greedier",
  "boss-rush",
  "isaac",
  "blue-baby",
  "satan",
  "the-lamb",
  "mega-satan",
  "hush",
  "mother",
  "the-beast",
  "delirium",
  "all-hard-marks",
]

const taintedBossDisplayOrder = [
  "tainted-final-bosses",
  "boss-rush-and-hush",
  "ultra-greedier",
  "mega-satan",
  "delirium",
  "mother",
  "the-beast",
]

const combinedBossIconKeys = {
  "boss-rush-and-hush": ["boss-rush", "hush"],
}

const getBossIconUrls = (bossKey) =>
  (combinedBossIconKeys[bossKey] || [bossKey])
    .map((iconKey) => bossIcons[`../assets/bosses/${iconKey}.png`])
    .filter(Boolean)

export const getCharacterUnlockables = (characterName) => {
  const characterUnlockables =
    unlockablesData[characterName] ??
    taintedUnlockablesData[characterName] ??
    []
  const characterSlug = getResourceSlug(characterName)
  const displayOrder = characterName.startsWith("Tainted ")
    ? taintedBossDisplayOrder
    : bossDisplayOrder

  return [...characterUnlockables]
    .sort(
      (firstUnlockable, secondUnlockable) =>
        displayOrder.indexOf(firstUnlockable.bossKey) -
        displayOrder.indexOf(secondUnlockable.bossKey)
    )
    .map((unlockable) => {
      const bossIconUrls = getBossIconUrls(unlockable.bossKey)

      return {
        ...unlockable,
        bossIconUrls,
        bossIcon: bossIconUrls[0],
        icon:
          rewardIcons[
            `../assets/unlockables/${characterSlug}/${getResourceSlug(
              unlockable.item
            )}.jpg`
          ],
      }
    })
}
