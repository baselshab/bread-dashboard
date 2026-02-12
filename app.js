const firebaseConfig = {
  apiKey: "AIzaSyCHbRPKAdG6oFTYrlu8KsfFRt7Kq8K34DA",
  authDomain: "bread-distribution-17af5.firebaseapp.com",
  databaseURL:
    "https://bread-distribution-17af5-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bread-distribution-17af5",
  storageBucket: "bread-distribution-17af5.firebasestorage.app",
  messagingSenderId: "664307565163",
  appId: "1:664307565163:web:604b4c4c73a1e92c36672e",
};

firebase.initializeApp(firebaseConfig);

// Realtime DB (ESP32)
const rtdb = firebase.database();

// Firestore (Customers)
const fs = firebase.firestore();

/* ===== ESP32 DATA ===== */
rtdb.ref("queueLength").on("value", (s) => {
  document.getElementById("queue").innerText = s.val();
  document.getElementById("queueCard").className =
    "card " + (s.val() <= 0 ? "yellow" : "");
});

rtdb.ref("stockLevel").on("value", (s) => {
  let val = s.val();
  document.getElementById("stock").innerText = val + "%";
  document.getElementById("stockCard").className =
    "card " + (val <= 20 ? "red" : "");
});

rtdb.ref("serveCount").on("value", (s) => {
  document.getElementById("serve").innerText = s.val();
});

/* ===== REGISTER + SERVE ===== */
function registerAndServe() {
  let n = document.getElementById("name").value.trim();
  let id = document.getElementById("idnum").value.trim();
  let btn = document.getElementById("mainBtn");

  if (!n || !id) {
    document.getElementById("msg").innerText = "❗ أدخل الاسم والرقم";
    return;
  }

  let docRef = fs.collection("peopleData").doc(id);

  docRef.get().then((doc) => {
    if (doc.exists) {
      document.getElementById("msg").innerText = "❌ الرقم مسجل مسبقًا";
    } else {
      docRef
        .set({
          name: n,
          time: firebase.firestore.FieldValue.serverTimestamp(),
        })
        .then(() => {
          document.getElementById("msg").innerText =
            "✅ تم حفظ البيانات وتم إرسال أمر الخدمة";
          document.getElementById("name").value = "";
          document.getElementById("idnum").value = "";

          // إرسال أمر الخدمة للـ ESP32
          rtdb.ref("command/serve").set(true);

          // تغيير الزر مؤقتًا
          btn.innerText = "تم التنفيذ ✅";
          btn.style.backgroundColor = "#28a745"; // أخضر
          setTimeout(() => {
            btn.innerText = "Save & Serve";
            btn.style.backgroundColor = "#007bff"; // يرجع أزرق
          }, 2000);
        })
        .catch((err) => {
          console.error("Firestore Error:", err);
          document.getElementById("msg").innerText = "⚠️ خطأ في التخزين";
        });
    }
  });
}

/* ===== DELETE CUSTOMER ===== */
function deleteCustomer(id) {
  if (confirm("هل تريد حذف هذا العميل؟")) {
    fs.collection("peopleData")
      .doc(id)
      .delete()
      .then(() => {
        console.log("✅ تم حذف العميل:", id);
      })
      .catch((err) => {
        console.error("⚠️ خطأ في الحذف:", err);
      });
  }
}

/* ===== CUSTOMERS LIST ===== */
fs.collection("peopleData")
  .orderBy("time", "desc")
  .onSnapshot((snapshot) => {
    document.getElementById("people").innerHTML = "";
    document.getElementById("total").innerText = snapshot.size;
    snapshot.forEach((doc) => {
      let d = doc.data();
      let dateStr = "";
      if (d.time) {
        let date = d.time.toDate();
        dateStr = date.toLocaleString("ar-EG");
      }
      document.getElementById("people").innerHTML += `
        <tr>
          <td>${doc.id}</td>
          <td>${d.name}</td>
          <td>${dateStr}</td>
          <td><button onclick="deleteCustomer('${doc.id}')">🗑️</button></td>
        </tr>`;
    });
  });

/* ===== CUSTOMER REGISTRATION CHART ===== */
const ctx = document.getElementById("regChart").getContext("2d");
const regChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Registrations",
        data: [],
        borderColor: "#007bff",
        backgroundColor: "rgba(0,123,255,0.3)",
        fill: true,
        tension: 0.3,
      },
    ],
  },
  options: {
    responsive: true,
    plugins: { legend: { position: "top" } },
    scales: {
      x: { title: { display: true, text: "Time" } },
      y: { title: { display: true, text: "Count" }, beginAtZero: true },
    },
  },
});

// تحديث الرسم البياني عند تغير البيانات
fs.collection("peopleData")
  .orderBy("time", "asc")
  .onSnapshot((snapshot) => {
    let labels = [];
    let counts = [];
    let total = 0;

    snapshot.forEach((doc) => {
      let d = doc.data();
      if (d.time) {
        let date = d.time.toDate();
        labels.push(date.toLocaleString("ar-EG"));
        total++;
        counts.push(total);
      }
    });

    regChart.data.labels = labels;
    regChart.data.datasets[0].data = counts;
    regChart.update();
  });

/* ===== REALTIME BREAD DATA CHART ===== */
const ctxBread = document.getElementById("breadChart").getContext("2d");
const breadChart = new Chart(ctxBread, {
  type: "bar",
  data: {
    labels: ["Queue Length", "Stock Level", "Serve Count"],
    datasets: [
      {
        label: "Realtime Values",
        data: [0, 0, 0],
        backgroundColor: ["#ffc107", "#28a745", "#007bff"],
      },
    ],
  },
  options: {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  },
});

// تحديث الرسم البياني عند تغير البيانات
rtdb.ref("queueLength").on("value", (s) => {
  breadChart.data.datasets[0].data[0] = s.val();
  breadChart.update();
});

rtdb.ref("stockLevel").on("value", (s) => {
  breadChart.data.datasets[0].data[1] = s.val();
  breadChart.update();
});

rtdb.ref("serveCount").on("value", (s) => {
  breadChart.data.datasets[0].data[2] = s.val();
  breadChart.update();
});
