import unlockablesData from "./unlockables.json"
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

export const getCharacterUnlockables = (characterName) => {
  const characterUnlockables = unlockablesData[characterName] ?? []
  const characterSlug = getResourceSlug(characterName)

  return [...characterUnlockables]
    .sort(
      (firstUnlockable, secondUnlockable) =>
        bossDisplayOrder.indexOf(firstUnlockable.bossKey) -
        bossDisplayOrder.indexOf(secondUnlockable.bossKey)
    )
    .map((unlockable) => ({
      ...unlockable,
      bossIcon: bossIcons[`../assets/bosses/${unlockable.bossKey}.png`],
      icon:
        rewardIcons[
          `../assets/unlockables/${characterSlug}/${getResourceSlug(
            unlockable.item
          )}.jpg`
        ],
    }))
}
