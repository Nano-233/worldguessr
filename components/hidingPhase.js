import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "@/components/useTranslations";
import { FaCheck, FaArrowLeft, FaEye, FaMapMarkerAlt, FaClock } from "react-icons/fa";

const MapWidget = dynamic(() => import("../components/Map"), { ssr: false });

export default function HidingPhase({
  ws,
  multiplayerState,
  timeOffset = 0,
  session,
  options,
}) {
  const { t: text } = useTranslation("common");
  const [pinPoint, setPinPoint] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [snapping, setSnapping] = useState(false);
  const svServiceRef = useRef(null);
  const iframeRef = useRef(null);

  const gameData = multiplayerState?.gameData;
  const nextEvtTime = gameData?.nextEvtTime;
  const players = gameData?.players || [];
  const hidingConfirmed = gameData?.hidingConfirmed || {};
  const myId = gameData?.myId;

  useEffect(() => {
    if (!nextEvtTime) return;
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((nextEvtTime - Date.now() - timeOffset) / 1000)
      );
      setTimeLeft(remaining);
    }, 250);
    return () => clearInterval(interval);
  }, [nextEvtTime, timeOffset]);

  useEffect(() => {
    setPinPoint(null);
    setPreviewing(false);
    setConfirmed(false);
    setSnapping(false);
  }, [gameData?.hideAndSeekCycle]);

  // Load Google Maps JS API and init StreetViewService
  useEffect(() => {
    const MAPS_KEY = "AIzaSyA_t5gb2Mn37dZjhsaJ4F-OPp1PWDxqZyI";
    const initSvService = () => {
      if (window.google?.maps?.StreetViewService) {
        svServiceRef.current = new window.google.maps.StreetViewService();
      }
    };
    if (window.google?.maps?.StreetViewService) {
      initSvService();
      return;
    }
    if (document.querySelector('script[data-gm-sv]')) {
      // Script already injected, wait for it
      const wait = setInterval(() => {
        if (window.google?.maps?.StreetViewService) {
          clearInterval(wait);
          initSvService();
        }
      }, 100);
      return () => clearInterval(wait);
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=streetView&loading=async`;
    script.async = true;
    script.dataset.gmSv = "1";
    script.onload = initSvService;
    document.head.appendChild(script);
  }, []);

  const handleSetPinPoint = useCallback((latLng) => {
    if (!latLng) { setPinPoint(null); return; }

    const snapTo = svServiceRef.current;
    if (!snapTo) {
      // Service not ready yet — set pin immediately, snap will happen on next click once loaded
      setPinPoint(latLng);
      return;
    }

    setSnapping(true);
    snapTo.getPanorama(
      { location: { lat: latLng.lat, lng: latLng.lng }, radius: 5000, preference: window.google.maps.StreetViewPreference.NEAREST },
      (data, status) => {
        if (status === window.google.maps.StreetViewStatus.OK && data?.location?.latLng) {
          const loc = data.location.latLng;
          setPinPoint({ lat: loc.lat(), lng: loc.lng() });
        } else {
          setPinPoint(latLng);
        }
        setSnapping(false);
      }
    );
  }, []);

  const sendHidingSpot = useCallback(
    (latLng, isConfirmed) => {
      if (!ws) return;
      ws.send(
        JSON.stringify({
          type: "setHidingSpot",
          latLong: [latLng.lat, latLng.lng],
          confirmed: isConfirmed,
        })
      );
    },
    [ws]
  );

  const handlePreview = () => {
    if (!pinPoint) return;
    sendHidingSpot(pinPoint, false);
    setPreviewing(true);
  };

  const handleConfirm = () => {
    if (!pinPoint) return;
    sendHidingSpot(pinPoint, true);
    setConfirmed(true);
    setPreviewing(false);
  };

  const handleBackToMap = () => {
    setPreviewing(false);
  };

  const confirmedCount = Object.values(hidingConfirmed).filter(Boolean).length;
  const totalPlayers = players.length;

  const previewSrc =
    pinPoint
      ? `https://www.google.com/maps/embed/v1/streetview?location=${pinPoint.lat},${pinPoint.lng}&key=AIzaSyA_t5gb2Mn37dZjhsaJ4F-OPp1PWDxqZyI&fov=100&language=en`
      : null;

  return (
    <div className="hiding-phase">
      {/* Timer bar */}
      <div className="hiding-phase__timer-bar">
        <FaClock style={{ marginRight: 6 }} />
        <span>
          {confirmed
            ? `Hiding spot confirmed! Waiting for others... (${confirmedCount}/${totalPlayers})`
            : `Pick your hiding spot! ${timeLeft !== null ? `${timeLeft}s` : ""}`}
        </span>
      </div>

      {/* Streetview Preview */}
      {previewing && previewSrc && !confirmed && (
        <div className="hiding-phase__preview">
          <iframe
            ref={iframeRef}
            src={previewSrc}
            className="hiding-phase__streetview"
            referrerPolicy="no-referrer-when-downgrade"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            loading="eager"
          />
          <div className="hiding-phase__preview-actions">
            <button
              className="hiding-phase__btn hiding-phase__btn--back"
              onClick={handleBackToMap}
            >
              <FaArrowLeft style={{ marginRight: 6 }} />
              Back to Map
            </button>
            <button
              className="hiding-phase__btn hiding-phase__btn--confirm"
              onClick={handleConfirm}
            >
              <FaCheck style={{ marginRight: 6 }} />
              Confirm Spot
            </button>
          </div>
        </div>
      )}

      {/* Confirmed overlay */}
      {confirmed && (
        <div className="hiding-phase__confirmed-overlay">
          <div className="hiding-phase__confirmed-card">
            <FaCheck
              style={{ fontSize: "2rem", color: "#4caf50", marginBottom: 12 }}
            />
            <h3>Spot Confirmed!</h3>
            <p>
              Waiting for other players... ({confirmedCount}/{totalPlayers})
            </p>
            <div className="hiding-phase__player-status">
              {players.map((p) => (
                <div key={p.id} className="hiding-phase__player-row">
                  <span>{p.username}</span>
                  <span
                    style={{
                      color: hidingConfirmed[p.id] ? "#4caf50" : "#ff9800",
                    }}
                  >
                    {hidingConfirmed[p.id] ? "Ready" : "Hiding..."}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Map — reuses the normal guess MapWidget + SV coverage overlay */}
      {!previewing && !confirmed && (
        <div className="hiding-phase__map-container">
          <MapWidget
            shown={true}
            focused={true}
            options={options}
            ws={null}
            gameOptions={{ location: "all", maxDist: 20000 }}
            answerShown={false}
            session={session}
            showHint={false}
            pinPoint={pinPoint}
            setPinPoint={handleSetPinPoint}
            guessed={false}
            guessing={false}
            location={null}
            setKm={() => {}}
            multiplayerState={null}
            svCoverageOverlay={true}
            pinLabel="Your hiding spot"
          />

          {/* Map action buttons */}
          <div className="hiding-phase__map-actions">
            {snapping && (
              <div className="hiding-phase__hint">
                Snapping to nearest Street View...
              </div>
            )}
            {pinPoint && !snapping && (
              <button
                className="hiding-phase__btn hiding-phase__btn--preview"
                onClick={handlePreview}
              >
                <FaEye style={{ marginRight: 6 }} />
                Preview Streetview
              </button>
            )}
            {!pinPoint && !snapping && (
              <div className="hiding-phase__hint">
                <FaMapMarkerAlt style={{ marginRight: 6 }} />
                Click on the map to pick a hiding spot
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .hiding-phase {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          background: #1a1a2e;
        }

        .hiding-phase__timer-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px 20px;
          background: linear-gradient(135deg, #1a2a1a 0%, #0d1a0d 100%);
          color: #fff;
          font-weight: 600;
          font-size: 1rem;
          z-index: 1010;
          border-bottom: 2px solid #4caf50;
        }

        .hiding-phase__map-container {
          flex: 1;
          position: relative;
        }

        .hiding-phase__map-actions {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1005;
          display: flex;
          gap: 12px;
        }

        .hiding-phase__hint {
          display: flex;
          align-items: center;
          padding: 12px 24px;
          background: rgba(0, 0, 0, 0.8);
          color: #fff;
          border-radius: 12px;
          font-size: 0.95rem;
          font-weight: 500;
          backdrop-filter: blur(8px);
        }


        .hiding-phase__btn {
          display: flex;
          align-items: center;
          padding: 14px 28px;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .hiding-phase__btn--preview {
          background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
          color: #fff;
        }

        .hiding-phase__btn--preview:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(33, 150, 243, 0.4);
        }

        .hiding-phase__btn--back {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .hiding-phase__btn--back:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        .hiding-phase__btn--confirm {
          background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
          color: #fff;
        }

        .hiding-phase__btn--confirm:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
        }

        .hiding-phase__preview {
          flex: 1;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .hiding-phase__streetview {
          flex: 1;
          width: 100%;
          border: none;
        }

        .hiding-phase__preview-actions {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 12px;
          z-index: 1005;
        }

        .hiding-phase__confirmed-overlay {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
        }

        .hiding-phase__confirmed-card {
          background: linear-gradient(165deg, #1a2a1a 0%, #0d1a0d 100%);
          border: 1px solid rgba(76, 175, 80, 0.3);
          border-radius: 20px;
          padding: 32px 40px;
          text-align: center;
          color: #fff;
          max-width: 400px;
          width: 90vw;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        }

        .hiding-phase__confirmed-card h3 {
          margin: 0 0 8px 0;
          font-size: 1.3rem;
        }

        .hiding-phase__confirmed-card p {
          margin: 0 0 20px 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.9rem;
        }

        .hiding-phase__player-status {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .hiding-phase__player-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          font-size: 0.85rem;
        }

        @media (max-width: 480px) {
          .hiding-phase__btn {
            padding: 12px 20px;
            font-size: 0.9rem;
          }
          .hiding-phase__preview-actions {
            flex-direction: column;
            bottom: 16px;
          }
          .hiding-phase__confirmed-card {
            padding: 24px 20px;
          }
        }
      `}</style>
    </div>
  );
}
