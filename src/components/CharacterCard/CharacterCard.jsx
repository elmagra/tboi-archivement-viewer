import { useState } from "react"
import "./CharacterCard.css"

import { getResourceSlug } from "../../utils/resource-slug"

const characterImages = import.meta.glob("../../assets/characters/*.webp", {
  eager: true,
  import: "default",
  query: "?url",
})

export default function CharacterCard({
  name,
  completed,
  total
}) {
  const [hasImageError, setHasImageError] = useState(false)

  const image =
    characterImages[`../../assets/characters/${getResourceSlug(name)}.webp`]

  const handleImageError = () => {
    setHasImageError(true)
  }

  const initials = name === "Blue Baby"
    ? "???"
    : name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .replace("&", "")

  return (
    <div className="character-card">
      {completed === total && (
        <span
          className="completion-crown"
          role="img"
          aria-label="Todas las marcas completadas"
        />
      )}

      <p className="archivementCounter">{completed}/{total}</p>

      {hasImageError ? (
        <span className="character-image character-image-fallback" aria-hidden="true">
          {initials}
        </span>
      ) : (
        <img
          className="character-image"
          src={image}
          alt={name}
          onError={handleImageError}
        />
      )}

      <h2 className="character-name">{name}</h2>
    </div>
  )
}