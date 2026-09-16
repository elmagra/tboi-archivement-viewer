import { useCallback, useEffect, useRef, useState } from "react"
import "./App.css"

import CharacterCard from "./components/CharacterCard/CharacterCard"
import SteamLogin, {
  SteamProfile,
} from "./components/SteamLogin/SteamLogin"
import { getApiUrl } from "./config/urls"

import { characters } from "./data/characters"
import { getCharacterUnlockables } from "./data/unlockables"
import englishTranslations from "./locales/en.json"
import spanishTranslations from "./locales/es.json"
import {
  captureAuthToken,
  getAuthHeaders,
} from "./services/auth-token"

const FULL_CIRCLE = Math.PI * 2
const SHOW_CAROUSEL_PROGRESS = true
const LANGUAGE_STORAGE_KEY = "tboi-viewer-language"
const translationsByLanguage = {
  en: englishTranslations,
  es: spanishTranslations,
}

const getInitialLanguage = () => {
  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)

  if (savedLanguage && translationsByLanguage[savedLanguage]) {
    return savedLanguage
  }

  return window.navigator.language.toLowerCase().startsWith("es") ? "es" : "en"
}

function App() {
  const [user, setUser] = useState(null)
  const [achievements, setAchievements] = useState([])
  const [language, setLanguage] = useState(getInitialLanguage)

  // Personaje que está seleccionado
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isShowingUnlockables, setIsShowingUnlockables] = useState(false)
  const [selectedUnlockable, setSelectedUnlockable] = useState(null)
  const unlockablesGridRef = useRef(null)
  const localizedUnlockableInfo = selectedUnlockable
    ? translationsByLanguage[language].unlockables[selectedUnlockable.item]
    : null
  const selectedCharacter = characters[selectedIndex]
  const selectedCharacterUnlockables = getCharacterUnlockables(
    selectedCharacter.name
  )

  const handleShowUnlockables = useCallback(() => {
    setIsShowingUnlockables(true)
  }, [])

  const handleHideUnlockables = useCallback(() => {
    setSelectedUnlockable(null)
    setIsShowingUnlockables(false)
  }, [])

  const handleCloseUnlockable = useCallback(() => {
    setSelectedUnlockable(null)
  }, [])

  const handleSelectUnlockable = (event) => {
    const achievementId = event.currentTarget.dataset.achievementId
    const unlockable = selectedCharacterUnlockables.find(
      (candidate) => candidate.achievementId === achievementId
    )

    if (!unlockable) return

    setSelectedUnlockable(unlockable)
  }

  const handleLanguageToggle = () => {
    const nextLanguage = language === "en" ? "es" : "en"

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
    setLanguage(nextLanguage)
  }

  useEffect(() => {
    if (!isShowingUnlockables || selectedUnlockable) return

    unlockablesGridRef.current?.focus()
  }, [isShowingUnlockables, selectedUnlockable])

  // =========================
  // COMPROBAR LOGIN
  // =========================

  useEffect(() => {
    captureAuthToken()

    fetch(getApiUrl("/api/me"), {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.loggedIn) {
          setUser(data.user)
        }
      })
      .catch((error) => {
        console.error("Error obteniendo usuario:", error)
      })
  }, [])


  // =========================
  // FLECHAS DEL TECLADO
  // =========================

  useEffect(() => {

    const handleKeyDown = (event) => {
      if (isShowingUnlockables) {
        const isInteractiveElement = event.target.closest?.("button, a")

        if (selectedUnlockable) {
          if (event.key === "Escape") {
            event.preventDefault()
            handleCloseUnlockable()
          }

          return
        }

        if (event.key === "Escape") {
          event.preventDefault()
          handleHideUnlockables()
          return
        }

        if (event.key === "Enter") {
          if (isInteractiveElement) return

          event.preventDefault()
          handleHideUnlockables()
          return
        }

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault()
          const scrollContainer = unlockablesGridRef.current

          if (!scrollContainer) return

          scrollContainer.scrollTo({
            top: event.key === "ArrowDown" ? scrollContainer.scrollHeight : 0,
            behavior: "smooth",
          })
        }

        return
      }

      // Flecha derecha
      if (event.key === "ArrowRight") {
        event.preventDefault()
        setSelectedIndex((actual) =>
          (actual + 1) % characters.length
        )
        return
      }


      // Flecha izquierda
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        setSelectedIndex((actual) =>
          (actual - 1 + characters.length) % characters.length
        )
        return
      }

      if (event.key === "Enter") {
        event.preventDefault()
        handleShowUnlockables()
      }

    }


    window.addEventListener("keydown", handleKeyDown)


    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }

  }, [
    handleCloseUnlockable,
    handleHideUnlockables,
    handleShowUnlockables,
    isShowingUnlockables,
    selectedUnlockable,
  ])


  // =========================
  // ACHIEVEMENTS
  // =========================

  useEffect(() => {

    if (!user) return

    fetch(getApiUrl("/api/achievements"), {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {

        console.log("Achievements de Steam:", data)

        const steamAchievements =
          data.playerstats?.achievements || []

        setAchievements(steamAchievements)

      })
      .catch((error) => {
        console.error("Error obteniendo achievements:", error)
      })

  }, [user])


  return (
    <div className={`app${isShowingUnlockables ? "" : " is-character-screen"}`}>
      {user && <SteamProfile user={user} />}

      {!isShowingUnlockables ? (
        <div className="character-screen-layout">
          <div className="disclaimers">
            <aside className="steam-disclaimer is-steam-warning" role="alert">
              <strong>PUBLIC STEAM PROFILE REQUIRED</strong>
              <span>
                Your Steam profile and Game details must be public to load
                achievements.
              </span>
            </aside>

            <aside className="steam-disclaimer is-early-access" role="note">
              <strong>EARLY ACCESS:</strong> This site is still in an early
              stage. Expect errors, changes, and future features.
            </aside>
          </div>

          <section className="character-paper">
            <SteamLogin user={user} />

            <main className="character-selector">
              <div
                className="character-wheel"
                role="listbox"
                aria-label="Selector de personajes"
                tabIndex={0}
                data-show-all-progress={SHOW_CAROUSEL_PROGRESS}
              >
              {characters.map((character, index) => {

                // =========================
                // CONTAR LOGROS
                // =========================

                const completed =
                  character.achievements.filter((achievementId) =>
                    achievements.some(
                      (steamAchievement) =>
                        steamAchievement.apiname === achievementId &&
                        steamAchievement.achieved === 1
                    )
                  ).length


                // =========================
                // POSICIÓN EN LA RUEDA
                // =========================

                let offset = index - selectedIndex


                // Hace que el círculo pueda continuar infinitamente
                if (offset > characters.length / 2) {
                  offset -= characters.length
                }

                if (offset < -characters.length / 2) {
                  offset += characters.length
                }


                const isSelected = offset === 0
                const isNextToSelected = Math.abs(offset) === 1
                const isSecondNextToSelected = Math.abs(offset) === 2
                const angle =
                  Math.PI / 2 - offset * (FULL_CIRCLE / characters.length)
                const x = Math.cos(angle)
                const y = Math.sin(angle)
                const sidePosition = Math.abs(Math.cos(angle))
                const backPosition = Math.max(0, -Math.sin(angle))
                const scale = isSelected
                  ? 1
                  : Math.max(
                      0.4,
                      0.66 +
                        backPosition * 0.06 -
                        sidePosition * 0.26 +
                        (isNextToSelected ? 0.14 : 0) +
                        (isSecondNextToSelected ? 0.08 : 0)
                    )
                const opacity = isSelected
                  ? 1
                  : 0.72 + backPosition * 0.16 - sidePosition * 0.08


                return (
                  <div
                    key={character.name}
                    className={`character-position${
                      isSelected ? " is-selected" : ""
                    }`}
                    role="option"
                    aria-selected={isSelected}

                    style={{
                      "--wheel-x": x,
                      "--wheel-y": y,
                      "--character-scale": scale,
                      opacity,
                      zIndex: isSelected ? 100 : Math.round(50 - y * 10),
                    }}
                  >

                    <CharacterCard
                      name={character.name}
                      completed={completed}
                      total={character.achievements.length}
                    />

                  </div>
                )

              })}

              </div>

              <button
                className="enter-button"
                type="button"
                onClick={handleShowUnlockables}
              >
                PRESS ENTER
              </button>
            </main>
          </section>
        </div>
      ) : (
        <section
          className="unlockables-section"
          aria-labelledby="character-unlockables-title"
        >
          <div className="unlockables-paper">
            <h2 id="character-unlockables-title">
              {selectedCharacter.name.toUpperCase()} UNLOCKABLES
            </h2>

            <ul
              className="unlockables-grid"
              ref={unlockablesGridRef}
              tabIndex={0}
              aria-label={`Desbloqueables de ${selectedCharacter.name}`}
            >
                {selectedCharacterUnlockables.map((unlockable) => {
                  const isUnlocked = achievements.some(
                    (achievement) =>
                      achievement.apiname === unlockable.achievementId &&
                      achievement.achieved === 1
                  )

                  return (
                    <li
                      key={unlockable.achievementId}
                      className="unlockable-list-item"
                    >
                      <button
                        className={`unlockable-card ${
                          isUnlocked ? "is-unlocked" : "is-locked"
                        }`}
                        type="button"
                        data-achievement-id={unlockable.achievementId}
                        onClick={handleSelectUnlockable}
                        aria-label={`Ver información de ${unlockable.item}`}
                      >
                        <div className="unlockable-boss">
                          <img
                            src={unlockable.bossIcon}
                            alt=""
                            className="boss-icon"
                          />
                          <span>{unlockable.boss}</span>
                        </div>

                        <span className="unlock-arrow" aria-hidden="true">→</span>

                        <div className="unlockable-reward">
                          <img
                            src={unlockable.icon}
                            alt=""
                            className="unlockable-icon"
                          />
                          <span>{unlockable.item}</span>
                        </div>
                      </button>
                    </li>
                  )
                })}
            </ul>

            <button
              className="enter-button unlockables-back-button"
              type="button"
              onClick={handleHideUnlockables}
            >
              ← BACK (ENTER)
            </button>
          </div>

          {selectedUnlockable && (
            <div
              className="unlockable-modal-backdrop"
              role="presentation"
            >
              <section
                className="unlockable-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="unlockable-modal-title"
              >
                <button
                  className="language-switch"
                  type="button"
                  role="switch"
                  aria-checked={language === "es"}
                  aria-label="Change description language"
                  onClick={handleLanguageToggle}
                >
                  <span
                    className={language === "en" ? "is-active" : ""}
                    aria-hidden="true"
                  >
                    EN
                  </span>
                  <span className="language-switch-separator" aria-hidden="true">
                    /
                  </span>
                  <span
                    className={language === "es" ? "is-active" : ""}
                    aria-hidden="true"
                  >
                    ES
                  </span>
                </button>

                <button
                  className="unlockable-modal-close"
                  type="button"
                  onClick={handleCloseUnlockable}
                  aria-label="Cerrar información"
                  autoFocus
                >
                  ×
                </button>

                <h3 id="unlockable-modal-title">
                  {selectedUnlockable.item}
                </h3>

                <div className="unlockable-modal-images">
                  <div>
                    <img
                      src={selectedUnlockable.bossIcon}
                      alt={selectedUnlockable.boss}
                      className="unlockable-modal-boss"
                    />
                    <span>{selectedUnlockable.boss}</span>
                  </div>

                  <span aria-hidden="true">→</span>

                  <div>
                    <img
                      src={selectedUnlockable.icon}
                      alt={selectedUnlockable.item}
                      className="unlockable-modal-item"
                    />
                    <span>{selectedUnlockable.item}</span>
                  </div>
                </div>

                <div className="unlockable-modal-details">
                  <h4>DESCRIPTION</h4>
                  <p>
                    {localizedUnlockableInfo?.description ||
                      "No short description is available."}
                  </p>
                  <h4 className="unlockable-modal-effect-title">EFFECT</h4>
                  <p>
                    {localizedUnlockableInfo?.effect ||
                      "This unlock has no separate effect summary."}
                  </p>
                </div>

                <a
                  className="unlockable-wiki-link"
                  href={`https://bindingofisaacrebirth.wiki.gg/index.php?search=${encodeURIComponent(
                    selectedUnlockable.item
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  VIEW ON THE WIKI ↗
                </a>
              </section>
            </div>
          )}
        </section>
      )}

    </div>
  )
}

export default App