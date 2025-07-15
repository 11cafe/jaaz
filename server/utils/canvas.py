from typing import Optional, Dict, Any, Union
from services.db_service import db_service

async def find_next_best_element_position(canvas_data, max_num_per_row=4, spacing=20):
    """
    Calculates the next best position for a new element on the canvas.
    This final version uses a robust row detection algorithm to handle complex layouts.
    """
    elements = canvas_data.get("elements", [])
    
    media_elements = [
        e for e in elements 
        if e.get("type") in ["image", "embeddable", "video"] and not e.get("isDeleted")
    ]

    if not media_elements:
        return 0, 0

    # Sort elements by their top-left corner
    media_elements.sort(key=lambda e: (e.get("y", 0), e.get("x", 0)))

    # Group elements into rows based on vertical overlap
    rows = []
    for element in media_elements:
        y, height = element.get("y", 0), element.get("height", 0)
        placed = False
        for row in rows:
            # Check if the element vertically overlaps with any element in the row
            if any(max(y, r.get("y", 0)) < min(y + height, r.get("y", 0) + r.get("height", 0)) for r in row):
                row.append(element)
                placed = True
                break
        if not placed:
            rows.append([element])

    # Sort rows by their average y-coordinate
    rows.sort(key=lambda row: sum(e.get("y", 0) for e in row) / len(row))

    if not rows:
        return 0, 0

    last_row = rows[-1]
    last_row.sort(key=lambda e: e.get("x", 0))

    if len(last_row) < max_num_per_row:
        # Add to the last row
        rightmost_element = last_row[-1]
        new_x = rightmost_element.get("x", 0) + rightmost_element.get("width", 0) + spacing
        # Align with the top of the last row for consistency
        new_y = min(e.get("y", 0) for e in last_row)
    else:
        # Start a new row
        new_x = 0
        # Position below the entire last row
        bottom_of_last_row = max(e.get("y", 0) + e.get("height", 0) for e in last_row)
        new_y = bottom_of_last_row + spacing

    return new_x, new_y