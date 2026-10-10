import { useCallback, useEffect, useRef, useState } from "react"
import "./App.css"

import CharacterCard from "./components/CharacterCard/CharacterCard"
import SteamLogin, {
  SteamProfile,
} from "./components/SteamLogin/SteamLogin"
import { getApiUrl } from "./config/urls"

import {
  characters,
  taintedCharacters,
} from "./data/characters"
import { getCharacterUnlockables } from "./data/unlockables"
import englishTranslations from "./locales/en.json"
import spanishTranslations from "./locales/es.json"
import {
  getAuthHeaders,
} from "./services/auth-token"

const FULL_CIRCLE = Math.PI * 2
const SHOW_CAROUSEL_PROGRESS = true
const CAROUSEL_HOLD_MS = 480
const SWIPE_DISTANCE_PX = 48
const LANGUAGE_STORAGE_KEY = "tboi-viewer-language"
const GITHUB_REPO_URL = "https://github.com/elmagra/tboi-archivement-viewer"

const isTypingTarget = (target) =>
  target instanceof HTMLElement &&
  Boolean(
    target.closest("input, textarea, select, [contenteditable='true']")
  )
const translationsByLanguage = {
  en: englishTranslations,
  es: spanishTranslations,
}

function GitHubMark() {
  return (
    <svg
      className="github-stamp-mark"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  )
}

function BossIcons({ iconUrls = [], className }) {
  const visibleIcons = iconUrls.filter(Boolean)
  const isCombined = visibleIcons.length > 1

  return (
    <div
      className={`boss-icon-group${isCombined ? " is-combined" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      {visibleIcons.map((iconUrl, index) => (
        <img
          key={`${iconUrl}-${index}`}
          src={iconUrl}
          alt=""
          className={`boss-icon${index === 0 ? " is-primary" : " is-secondary"}`}
        />
      ))}
    </div>
  )
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
  const [isTaintedMode, setIsTaintedMode] = useState(false)

  // Personaje que está seleccionado
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isShowingUnlockables, setIsShowingUnlockables] = useState(false)
  const [selectedUnlockable, setSelectedUnlockable] = useState(null)
  const unlockablesGridRef = useRef(null)
  const heldCarouselKeyRef = useRef(null)
  const carouselHoldTimerRef = useRef(null)
  const swipeStateRef = useRef({
    x: null,
    isDragging: false,
    didSwipe: false,
  })
  const localizedUnlockableInfo = selectedUnlockable
    ? translationsByLanguage[language].unlockables[selectedUnlockable.item]
    : null
  const activeCharacters = isTaintedMode ? taintedCharacters : characters
  const selectedCharacter = activeCharacters[selectedIndex] ?? activeCharacters[0]
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

  const handleToggleCharacterMode = useCallback(() => {
    const nextCharacterCount = isTaintedMode
      ? characters.length
      : taintedCharacters.length

    setSelectedUnlockable(null)
    setIsTaintedMode((isCurrentlyTainted) => !isCurrentlyTainted)
    setSelectedIndex((index) => (index < nextCharacterCount ? index : 0))
  }, [isTaintedMode])

  const handleStopCarouselHold = useCallback(() => {
    if (carouselHoldTimerRef.current) {
      window.clearInterval(carouselHoldTimerRef.current)
      carouselHoldTimerRef.current = null
    }

    heldCarouselKeyRef.current = null
  }, [])

  const handleMoveSelection = useCallback((direction) => {
    setSelectedIndex((actualIndex) => {
      const characterCount = isTaintedMode
        ? taintedCharacters.length
        : characters.length

      return (actualIndex + direction + characterCount) % characterCount
    })
  }, [isTaintedMode])

  const handleStartCarouselHold = useCallback((key, direction) => {
    if (heldCarouselKeyRef.current === key) return

    handleStopCarouselHold()
    heldCarouselKeyRef.current = key
    handleMoveSelection(direction)
    carouselHoldTimerRef.current = window.setInterval(() => {
      handleMoveSelection(direction)
    }, CAROUSEL_HOLD_MS)
  }, [handleMoveSelection, handleStopCarouselHold])

  const handleCarouselButtonPointerDown = (key, direction) => (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return

    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    handleStartCarouselHold(key, direction)
  }

  const handleSelectCharacter = (index) => {
    if (swipeStateRef.current.didSwipe || swipeStateRef.current.isDragging) return

    if (index === selectedIndex) {
      handleShowUnlockables()
      return
    }

    setSelectedIndex(index)
  }

  const handleWheelPointerDown = (event) => {
    if (event.target.closest(".carousel-arrow")) return

    swipeStateRef.current = {
      x: event.clientX,
      isDragging: false,
      didSwipe: false,
    }
  }

  const handleWheelPointerMove = (event) => {
    if (swipeStateRef.current.x == null) return

    if (Math.abs(event.clientX - swipeStateRef.current.x) >= SWIPE_DISTANCE_PX) {
      swipeStateRef.current.isDragging = true
    }
  }

  const handleWheelPointerUp = (event) => {
    const { x, isDragging } = swipeStateRef.current
    swipeStateRef.current = {
      x: null,
      isDragging: false,
      didSwipe: isDragging,
    }

    if (!isDragging) return

    const deltaX = event.clientX - x

    if (Math.abs(deltaX) < SWIPE_DISTANCE_PX) return

    handleMoveSelection(deltaX < 0 ? 1 : -1)
  }

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

  useEffect(() => {
    if (isShowingUnlockables) {
      handleStopCarouselHold()
    }
  }, [handleStopCarouselHold, isShowingUnlockables])

  // =========================
  // COMPROBAR LOGIN
  // =========================

  useEffect(() => {
    fetch(getApiUrl("/api/me"), {
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
      if (isTypingTarget(event.target)) return

      if (isShowingUnlockables) {
        handleStopCarouselHold()
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

      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault()

        if (event.repeat) return

        handleStartCarouselHold(
          event.key,
          event.key === "ArrowRight" ? 1 : -1
        )
        return
      }

      handleStopCarouselHold()

      if (event.key.toLowerCase() === "e" && !event.repeat) {
        event.preventDefault()
        handleToggleCharacterMode()
        return
      }

      if (event.key === "Enter" && !event.repeat) {
        event.preventDefault()
        handleShowUnlockables()
      }
    }

    const handleKeyUp = (event) => {
      if (heldCarouselKeyRef.current === event.key) {
        handleStopCarouselHold()
      }
    }

    const handleWindowBlur = () => {
      handleStopCarouselHold()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleStopCarouselHold()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("blur", handleWindowBlur)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      handleStopCarouselHold()
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("blur", handleWindowBlur)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [
    handleCloseUnlockable,
    handleHideUnlockables,
    handleShowUnlockables,
    handleStartCarouselHold,
    handleStopCarouselHold,
    handleToggleCharacterMode,
    isShowingUnlockables,
    selectedUnlockable,
  ])


  // =========================
  // ACHIEVEMENTS
  // =========================

  useEffect(() => {

    if (!user) return

    fetch(getApiUrl("/api/achievements"), {
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
    <div
      className={`app${isShowingUnlockables ? "" : " is-character-screen"}${
        isTaintedMode ? " is-tainted-mode" : ""
      }${user ? " is-logged-in" : ""}`}
    >
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

            <a
              className="github-stamp"
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="View source on GitHub"
            >
              <GitHubMark />
              <span>GitHub</span>
            </a>
          </div>

          <section className="character-paper">
            <button
              className="character-mode-card"
              type="button"
              aria-pressed={isTaintedMode}
              aria-label={
                isTaintedMode
                  ? "Switch to normal characters"
                  : "Switch to Tainted characters"
              }
              onClick={handleToggleCharacterMode}
            >
              <span className="character-mode-key">E</span>
              <span>{isTaintedMode ? "NORMAL" : "TAINTED"}</span>
            </button>

            <SteamLogin user={user} />

            <main className="character-selector">
              <div className="character-wheel-row">
                <button
                  className="carousel-arrow is-prev"
                  type="button"
                  aria-label="Personaje anterior"
                  onPointerDown={handleCarouselButtonPointerDown("ArrowLeft", -1)}
                  onPointerUp={handleStopCarouselHold}
                  onPointerCancel={handleStopCarouselHold}
                  onLostPointerCapture={handleStopCarouselHold}
                >
                  ‹
                </button>

                <div
                  className="character-wheel"
                  role="listbox"
                  aria-label="Selector de personajes"
                  aria-activedescendant={`character-option-${selectedIndex}`}
                  tabIndex={0}
                  data-show-all-progress={SHOW_CAROUSEL_PROGRESS}
                  onPointerDown={handleWheelPointerDown}
                  onPointerMove={handleWheelPointerMove}
                  onPointerUp={handleWheelPointerUp}
                  onPointerCancel={handleWheelPointerUp}
                >
              {activeCharacters.map((character, index) => {

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
                if (offset > activeCharacters.length / 2) {
                  offset -= activeCharacters.length
                }

                if (offset < -activeCharacters.length / 2) {
                  offset += activeCharacters.length
                }


                const isSelected = offset === 0
                const isNextToSelected = Math.abs(offset) === 1
                const isSecondNextToSelected = Math.abs(offset) === 2
                const angle =
                  Math.PI / 2 - offset * (FULL_CIRCLE / activeCharacters.length)
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
                    id={`character-option-${index}`}
                    className={`character-position${
                      isSelected ? " is-selected" : ""
                    }`}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={-1}
                    onClick={() => handleSelectCharacter(index)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return

                      event.preventDefault()
                      event.stopPropagation()
                      handleSelectCharacter(index)
                    }}

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
                  className="carousel-arrow is-next"
                  type="button"
                  aria-label="Personaje siguiente"
                  onPointerDown={handleCarouselButtonPointerDown("ArrowRight", 1)}
                  onPointerUp={handleStopCarouselHold}
                  onPointerCancel={handleStopCarouselHold}
                  onLostPointerCapture={handleStopCarouselHold}
                >
                  ›
                </button>
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
                          <BossIcons iconUrls={unlockable.bossIconUrls} />
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
                    <BossIcons
                      iconUrls={selectedUnlockable.bossIconUrls}
                      className="unlockable-modal-boss-group"
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