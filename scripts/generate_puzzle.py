#!/usr/bin/env python3
"""
Generates daily historical timeline puzzle using Google Gemini API.
Produces public/data/puzzle_diario.json with 4 events <50 years apart
but from distinct eras.

Usage: python scripts/generate_puzzle.py
Requires: GEMINI_API_KEY environment variable or .env file
"""

import json
import os
import random
import re
import sys
from datetime import datetime, timedelta

# Fix Windows console encoding for emoji output
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# Try to load .env if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# Fallback deterministic dataset if Gemini API fails
FALLBACK_EVENTS = [
    {
        "id": 1,
        "name": "Fundación de Nintendo",
        "year": 1889,
        "fact": "Nintendo empezó vendiendo cartas Hanafuda en Kioto."
    },
    {
        "id": 2,
        "name": "Lanzamiento del iPhone",
        "year": 2007,
        "fact": "Steve Jobs presentó el iPhone en MacWorld SF."
    },
    {
        "id": 3,
        "name": "Primera edición de la Olimpiada Moderna",
        "year": 1896,
        "fact": "Se celebraron en Atenas con atletas de 14 países."
    },
    {
        "id": 4,
        "name": "Invención de la WWW",
        "year": 1989,
        "fact": "Tim Berners-Lee propuso hipertexto en CERN."
    },
    {
        "id": 5,
        "name": "Caudillo de la Revolución Francesa",
        "year": 1789,
        "fact": "Caída de la Bastilla marcó el inicio del fin del Antiguo Régimen."
    },
    {
        "id": 6,
        "name": "Primer vuelo de los hermanos Wright",
        "year": 1903,
        "fact": "12 segundos en el aire en Kitty Hawk, Carolina del Norte."
    },
    {
        "id": 7,
        "name": "Caída del Muro de Berlín",
        "year": 1989,
        "fact": "La gente subió al muro cantando la canción de la unidad."
    },
    {
        "id": 8,
        "name": "Lanzamiento de Windows 95",
        "year": 1995,
        "fact": "Incluyó el primer botón 'Start' en el menú de tareas."
    },
]

# Gemini API setup
try:
    import google.generativeai as genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-flash-lite-latest")
except Exception as e:
    print(f"WARNING: Gemini API not available ({e}). Using fallback dataset.")
    model = None


def generate_four_events() -> list[dict]:
    """Generate 4 historical events with <50 years spread but distinct eras."""

    if model:
        # Pick a random era to force variety
        eras = [
            ("siglos XV-XVII", "1400-1699"),
            ("siglo XVIII", "1700-1799"),
            ("siglos XIX-XX", "1800-1999"),
            ("prehistoria-antiguedad", "-3000 to 476"),
            ("edad media-renaacimiento", "500-1499"),
            ("primeros deportes/arte", "1776-1896"),
            ("guerras mundiales", "1914-1945"),
            ("guerra fria/espacio", "1947-1991"),
            ("internet/moderno", "1969-2010"),
        ]
        era_label, era_range = random.choice(eras)

        prompt = (
            f"Genera 4 eventos historicos o hitos culturales de la epoca: {era_label} ({era_range}). "
            "REGLAS ESTRICTAS:\n"
            "1. Cada evento: name (string, corto), year (number dentro del rango), fact (string, max 15 palabras en espanol).\n"
            "2. El rango entre year minimo y maximo NO puede superar 50 anos.\n"
            "3. Deben parecer de eras MUY distintas entre si.\n"
            "4. NO uses estos eventos: Torre Eiffel, Lumiere, Radio, Vuelo Wright, Nintendo, Olimpiadas, WWW.\n"
            "5. Devuelve SOLO JSON valido, sin texto adicional, sin markdown:\n"
            '{"events":[{"id":1,"name":"...","year":1889,"fact":"..."},{"id":2,"name":"...","year":1896,"fact":"..."},{"id":3,"name":"...","year":1898,"fact":"..."},{"id":4,"name":"...","year":1903,"fact":"..."}]}'
        )

        try:
            response = model.generate_content(
                prompt,
                generation_config={"max_output_tokens": 500, "temperature": 1.0},
            )
            text = response.text.strip()

            # Find JSON block between first { and last }
            start = text.index("{")
            end = text.rindex("}") + 1
            json_text = text[start:end]

            data = json.loads(json_text)
            events = data.get("events", [])
            if len(events) == 4 and all(
                "id" in e and "name" in e and "year" in e and "fact" in e for e in events
            ):
                # Validate <50 year spread
                years = [e["year"] for e in events]
                if max(years) - min(years) <= 50:
                    # Renumber IDs sequentially starting from 1
                    for i, e in enumerate(events, 1):
                        e["id"] = i
                    return events
                else:
                    print(
                        f"SPREAD TOO WIDE: {max(years)} - {min(years)} = {max(years) - min(years)} years"
                    )
            else:
                print(f"Invalid events structure: {events}")

        except (json.JSONDecodeError, ValueError, Exception) as e:
            print(f"Gemini generation error: {e}")

    # Fallback: select 4 random events from curated list and validate spread
    fallback = FALLBACK_EVENTS.copy()
    random.shuffle(fallback)
    selected = fallback[:4]

    years = [e["year"] for e in selected]
    if max(years) - min(years) > 50:
        # If spread too wide, just pick first 4 from original list
        selected = FALLBACK_EVENTS[:4]

    # Renumber IDs
    for i, e in enumerate(selected, 1):
        e["id"] = i

    return selected


def main():
    """Main entry point: generate puzzle and write to JSON file."""
    events = generate_four_events()

    # Build puzzle structure
    today = datetime.utcnow().strftime("%Y-%m-%d")
    puzzle = {
        "id": today,
        "events": events,
    }

    # Ensure output directory exists
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, "puzzle_diario.json")

    # Debug: verify encoding before writing
    sample = puzzle["events"][0]["fact"]
    print(f"DEBUG: sample fact repr = {repr(sample)}")
    try:
        sample.encode("utf-8")
        print("DEBUG: UTF-8 encode OK")
    except Exception as e:
        print(f"DEBUG: UTF-8 encode FAILED: {e}")

    # Write JSON with pretty formatting
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(puzzle, f, ensure_ascii=False, indent=2)

    # Verify what was written
    with open(output_path, "r", encoding="utf-8") as f:
        content = f.read()
    print(f"DEBUG: file size = {len(content)} chars")
    if "�" in content:
        print("DEBUG: WARNING - replacement characters found in file!")
    else:
        print("DEBUG: file content OK (no replacement chars)")

    print(f"✅ Daily puzzle generated: {output_path}")
    print(f"   Date ID: {today}")
    print(f"   Events: {len(events)} historical events")
    for e in events:
        print(f"   - {e['year']}: {e['name']} ({e['fact']})")


if __name__ == "__main__":
    main()