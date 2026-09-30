import { useEffect, useState } from "react";
import { loadCSVData } from "../utils/csvData";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

function Dashboard({ analysisResults = [] }) {

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [totalComponents, setTotalComponents] = useState(0);
  const [passComponents, setPassComponents] = useState(0);
  const [reviewComponents, setReviewComponents] = useState(0);
  const [rejectComponents, setRejectComponents] = useState(0);
  const [totalLots, setTotalLots] = useState(0);

  const [chartData, setChartData] = useState([]);

  /*
  =====================================================
  LOAD DASHBOARD DATA
  =====================================================
  */

  useEffect(() => {

    async function loadDashboardData() {

      try {

        /*
        -----------------------------------------------
        LOAD CSV
        -----------------------------------------------
        Used only for:
        - lot count
        - parameter monitoring chart
        */

        const csv = await loadCSVData();

        setData(csv);


        /*
        -----------------------------------------------
        GET REAL ANALYSIS RESULTS
        -----------------------------------------------
        Priority:

        1. analysisResults from App.jsx
        2. localStorage fallback

        Backend JSON is the source of truth.
        */

        let results = analysisResults;

        if (!results || results.length === 0) {

          const storedResults =
            localStorage.getItem(
              "burnInAnalysisResults"
            );

          results = storedResults
            ? JSON.parse(storedResults)
            : [];
        }


        /*
        -----------------------------------------------
        VERDICT COUNTS
        -----------------------------------------------
        New architecture:

        PASS
        FLAG_FOR_REVIEW
        REJECT
        */

        let pass = 0;
        let review = 0;
        let reject = 0;


        results.forEach((result) => {

          const verdict =
            String(result?.final_verdict || "")
              .trim()
              .toUpperCase();

          if (verdict === "PASS") {

            pass++;

          } else if (
            verdict === "FLAG_FOR_REVIEW"
          ) {

            review++;

          } else if (
            verdict === "REJECT"
          ) {

            reject++;

          }

        });


        /*
        -----------------------------------------------
        TOTAL ANALYZED COMPONENTS
        -----------------------------------------------
        */

        const total = results.length;


        /*
        -----------------------------------------------
        LOT COUNT
        -----------------------------------------------
        */

        const lots = [
          ...new Set(
            csv
              .map((item) => item.lot_id)
              .filter(Boolean)
          ),
        ];


        /*
        -----------------------------------------------
        UPDATE STATE
        -----------------------------------------------
        */

        setTotalComponents(total);
        setPassComponents(pass);
        setReviewComponents(review);
        setRejectComponents(reject);
        setTotalLots(lots.length);


        /*
        =================================================
        BURN-IN TREND CHART
        =================================================

        Supports the existing CSV structure:

        timestamp_h
        leakage_uA
        */

        const timestamps = [
          0,
          24,
          96,
          168,
        ];


        const trend = timestamps.map((time) => {

          const rows = csv.filter(
            (item) =>
              Number(item.timestamp_h) === time
          );


          const average =
            rows.length > 0
              ? rows.reduce(
                  (sum, row) =>
                    sum +
                    Number(
                      row.leakage_uA || 0
                    ),
                  0
                ) / rows.length
              : 0;


          return {

            time: `${time}h`,

            leakage:
              Number(
                average.toFixed(3)
              ),

          };

        });


        setChartData(trend);

        setLoading(false);

      } catch (error) {

        console.error(
          "Failed to load dashboard data:",
          error
        );

        setLoading(false);

      }

    }


    loadDashboardData();

  }, [analysisResults]);


  /*
  =====================================================
  LOADING
  =====================================================
  */

  if (loading) {

    return (
      <div className="dashboard-loading">

        Loading Burn-In screening dashboard...

      </div>
    );

  }


  /*
  =====================================================
  SCREENING TOTAL
  =====================================================
  */

  const screenedTotal =
    passComponents +
    reviewComponents +
    rejectComponents;


  /*
  =====================================================
  PERCENTAGES
  =====================================================
  */

  const passPercentage =
    screenedTotal > 0
      ? (passComponents / screenedTotal) * 100
      : 0;

  const reviewPercentage =
    screenedTotal > 0
      ? (reviewComponents / screenedTotal) * 100
      : 0;

  const rejectPercentage =
    screenedTotal > 0
      ? (rejectComponents / screenedTotal) * 100
      : 0;


  /*
  =====================================================
  SYSTEM CONDITION
  =====================================================
  */

  const systemReady =
    totalComponents > 0;


  return (

    <div className="dashboard-page">


      {/* =================================================
          HEADER
      ================================================= */}

      <div className="dashboard-heading">

        <div>

          <span className="dashboard-eyebrow">
            BURN-IN SCREENING SYSTEM
          </span>

          <h1>
            Screening Dashboard
          </h1>

          <p>
            System-level overview of component anomaly
            detection and 168h drift prediction.
          </p>

        </div>


        <div className="dashboard-status">

          <span className="status-dot"></span>

          {systemReady
            ? "SYSTEM READY"
            : "WAITING FOR ANALYSIS"}

        </div>

      </div>


      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="dashboard-stats">


        {/* TOTAL */}

        <div className="dashboard-stat-card">

          <span className="stat-label">
            TOTAL COMPONENTS
          </span>

          <strong>
            {totalComponents}
          </strong>

          <small>
            Components analyzed
          </small>

        </div>


        {/* PASS */}

        <div className="dashboard-stat-card">

          <span className="stat-label">
            PASS
          </span>

          <strong className="stat-normal">
            {passComponents}
          </strong>

          <small>
            Within screening criteria
          </small>

        </div>


        {/* FLAG FOR REVIEW */}

        <div className="dashboard-stat-card">

          <span className="stat-label">
            FLAG FOR REVIEW
          </span>

          <strong
            style={{
              color: "#d97706",
            }}
          >
            {reviewComponents}
          </strong>

          <small>
            Requires manual inspection
          </small>

        </div>


        {/* REJECT */}

        <div className="dashboard-stat-card">

          <span className="stat-label">
            REJECT
          </span>

          <strong className="stat-anomaly">
            {rejectComponents}
          </strong>

          <small>
            High-risk components
          </small>

        </div>

      </div>


      {/* =================================================
          MAIN GRID
      ================================================= */}

      <div className="dashboard-main-grid">


        {/* =================================================
            SCREENING OVERVIEW
        ================================================= */}

        <div className="dashboard-card screening-card">

          <div className="dashboard-card-header">

            <div>

              <span className="section-code">
                SCREENING / 01
              </span>

              <h2>
                Screening Overview
              </h2>

            </div>

          </div>


          <div className="screening-overview">


            {/* PASS */}

            <div className="screening-row">

              <div className="screening-label">

                <span
                  className="indicator normal-indicator"
                ></span>

                Pass

              </div>

              <strong>
                {passComponents}
              </strong>

            </div>


            <div className="screening-bar">

              <div
                className="screening-bar-normal"
                style={{
                  width:
                    `${passPercentage}%`,
                }}
              ></div>

            </div>


            {/* FLAG FOR REVIEW */}

            <div className="screening-row">

              <div className="screening-label">

                <span
                  className="indicator"
                  style={{
                    backgroundColor:
                      "#d97706",
                  }}
                ></span>

                Flag for Review

              </div>

              <strong>
                {reviewComponents}
              </strong>

            </div>


            <div className="screening-bar">

              <div
                style={{
                  width:
                    `${reviewPercentage}%`,
                  height: "100%",
                  backgroundColor:
                    "#d97706",
                }}
              ></div>

            </div>


            {/* REJECT */}

            <div className="screening-row">

              <div className="screening-label">

                <span
                  className="indicator anomaly-indicator"
                ></span>

                Reject

              </div>

              <strong>
                {rejectComponents}
              </strong>

            </div>


            <div className="screening-bar">

              <div
                className="screening-bar-anomaly"
                style={{
                  width:
                    `${rejectPercentage}%`,
                }}
              ></div>

            </div>


          </div>

        </div>


        {/* =================================================
            SYSTEM STATUS
        ================================================= */}

        <div className="dashboard-card system-card">

          <div className="dashboard-card-header">

            <div>

              <span className="section-code">
                SYSTEM / 02
              </span>

              <h2>
                System Status
              </h2>

            </div>

          </div>


          <div className="system-status-list">


            {/* DATASET */}

            <div className="system-status-row">

              <div>

                <span className="system-indicator"></span>

                Dataset

              </div>

              <strong>
                {data.length > 0
                  ? "LOADED"
                  : "WAITING"}
              </strong>

            </div>


            {/* MODULE A */}

            <div className="system-status-row">

              <div>

                <span className="system-indicator"></span>

                Module A

              </div>

              <strong>
                {totalComponents > 0
                  ? "READY"
                  : "WAITING"}
              </strong>

            </div>


            {/* MODULE B */}

            <div className="system-status-row">

              <div>

                <span className="system-indicator"></span>

                Module B

              </div>

              <strong>
                {totalComponents > 0
                  ? "READY"
                  : "WAITING"}
              </strong>

            </div>


            {/* PROCESSING */}

            <div className="system-status-row">

              <div>

                <span className="system-indicator"></span>

                Processing

              </div>

              <strong>
                LOCAL
              </strong>

            </div>


          </div>

        </div>

      </div>


      {/* =================================================
          CHART
      ================================================= */}

      <div className="dashboard-card dashboard-chart-card">

        <div className="dashboard-card-header">

          <div>

            <span className="section-code">
              PARAMETER / 03
            </span>

            <h2>
              Burn-In Parameter Monitoring
            </h2>

            <p>
              Average leakage measurement across
              available Burn-In time points.
            </p>

          </div>


          <div className="chart-unit">

            Leakage

            <span>
              µA
            </span>

          </div>

        </div>


        <div className="dashboard-chart">

          <ResponsiveContainer
            width="100%"
            height={320}
          >

            <LineChart
              data={chartData}
            >

              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="time"
              />

              <YAxis />

              <Tooltip />


              <Line
                type="monotone"
                dataKey="leakage"
                stroke="#1d4ed8"
                strokeWidth={3}
                dot={{
                  r: 4,
                }}
                activeDot={{
                  r: 6,
                }}
              />

            </LineChart>

          </ResponsiveContainer>

        </div>

      </div>


      {/* =================================================
          MODULES
      ================================================= */}

      <div className="dashboard-module-grid">


        {/* MODULE A */}

        <div className="dashboard-module-card">

          <div className="module-number">
            A
          </div>

          <div>

            <span className="section-code">
              MODULE A
            </span>

            <h3>
              Statistical Anomaly Detection
            </h3>

            <p>
              Lot-relative screening using
              Median / MAD z-score analysis
              and failure-signature matching.
            </p>

          </div>

          <div className="module-status">
            ACTIVE
          </div>

        </div>


        {/* MODULE B */}

        <div className="dashboard-module-card">

          <div className="module-number">
            B
          </div>

          <div>

            <span className="section-code">
              MODULE B
            </span>

            <h3>
              168h Drift Prediction
            </h3>

            <p>
              XGBoost prediction of 168h drift compared
              with the global safety slope.
            </p>

          </div>

          <div className="module-status">
            ACTIVE
          </div>

        </div>


      </div>


      {/* =================================================
          SCREENING NOTE
      ================================================= */}

      <div className="dashboard-note">

        <strong>
          SCREENING NOTE
        </strong>

        <span>

          Final component screening decisions are based
          on the backend analysis results:

          {" "}
          PASS,
          {" "}
          FLAG_FOR_REVIEW,
          {" "}
          or
          {" "}
          REJECT.

        </span>

      </div>


    </div>

  );

}

export default Dashboard;
