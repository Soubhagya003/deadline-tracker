// const API_BASE = "http://127.0.0.1:8000/api/deadlines";


// function formatDate(dateStr) {
//   const date = new Date(dateStr);
//   return isNaN(date) ? "No Due Date" : date.toLocaleString();
// }

// // Render deadlines
// // function renderDeadlines(deadlines) {
// //   const list = document.getElementById("deadline-list");
// //   list.innerHTML = "";


// function renderDeadlines(deadlines) {
//   const list = document.getElementById("deadline-list");
//   list.innerHTML = "";

//   if (deadlines.length === 0) {
//     list.innerHTML = "<p>No deadlines found</p>";
//     return;
//   }

//   deadlines.forEach(d => {
//     const item = document.createElement("div");

//     // Priority 
//     let priorityClass = "safe";
//     if (d.due) {
//       const due = new Date(d.due);
//       const now = new Date();
//       const diffDays = (due - now) / (1000 * 60 * 60 * 24);
//       if (diffDays < 1) priorityClass = "urgent";
//       else if (diffDays < 3) priorityClass = "soon";
//     }

//     item.className = `deadline-card ${priorityClass}`;
//     item.innerHTML = `
//       <h3>${d.title}</h3>
//       <p>Due: ${formatDate(d.due)}</p>
//     `;
//     list.appendChild(item);
//   });
// }




// // Fetchh  from backend
// async function fetchDeadlines() {
//   try {
//     const res = await fetch(`${API_BASE}/google/all`);
//     const data = await res.json();
//     renderDeadlines(data);
//   } catch (err) {
//     console.error("❌ Error fetching deadlines:", err);
//     document.getElementById("deadline-list").innerHTML = "<p>Error loading deadlines</p>";
//   }
// }

// // Auto-fetch when page loads
// fetchDeadlines();

const API_BASE = "http://127.0.0.1:8000/api/deadlines";

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return isNaN(date) ? "No Due Date" : date.toLocaleString();
}

function renderDeadlines(active, missed) {
  const activeList = document.getElementById("deadline-list");
  const missedList = document.getElementById("missed-deadline-list");

  activeList.innerHTML = "";
  missedList.innerHTML = "";

  // Active deadlines
  if (active.length === 0) {
    activeList.innerHTML = "<p>No upcoming deadlines 🎉</p>";
  } else {
    active.forEach(d => {
      const item = document.createElement("div");

      // Priority class
      let priorityClass = "safe";
      if (d.due) {
        const due = new Date(d.due);
        const now = new Date();
        const diffDays = (due - now) / (1000 * 60 * 60 * 24);
        if (diffDays < 1) priorityClass = "urgent";    // orange
        else if (diffDays < 3) priorityClass = "soon"; // yellow
      }

      item.className = `deadline-card ${priorityClass}`;
      item.innerHTML = `
        <h3>${d.title}</h3>
        <p>Due: ${formatDate(d.due)}</p>
      `;
      activeList.appendChild(item);
    });
  }

  // Missed deadlines
  if (missed.length === 0) {
    missedList.innerHTML = "<p>No missed deadlines ✅</p>";
  } else {
    missed.forEach(d => {
      const item = document.createElement("div");
      item.className = "deadline-card missed";
      item.innerHTML = `
        <h3>${d.title}</h3>
        <p>Was due: ${formatDate(d.due)}</p>
      `;
      missedList.appendChild(item);
    });
  }
}

async function fetchDeadlines() {
  try {
    const res = await fetch(`${API_BASE}/google/all`);
    let data = await res.json();

    const now = new Date();

    // Separate active vs missed
    const active = data
      .filter(d => !d.due || new Date(d.due) >= now)
      .sort((a, b) => {
        if (!a.due) return 1;
        if (!b.due) return -1;
        return new Date(a.due) - new Date(b.due);
      });

    const missed = data
      .filter(d => d.due && new Date(d.due) < now)
      .sort((a, b) => new Date(b.due) - new Date(a.due)); // latest missed first

    renderDeadlines(active, missed);
  } catch (err) {
    console.error("❌ Error fetching deadlines:", err);
    document.getElementById("deadline-list").innerHTML = "<p>Error loading deadlines</p>";
  }
}

// Auto-fetch when page loads
fetchDeadlines();
