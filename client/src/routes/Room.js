/* eslint-disable react-hooks/exhaustive-deps */

import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import style from "./Rooms.module.css";
import date from "date-and-time";

//Image imports

import micOff from "../assets/outline_mic_off_white_48dp.png";
import micOn from "../assets/outline_mic_white_48dp.png";
import videoOn from "../assets/outline_videocam_white_48dp.png";
import videoOff from "../assets/outline_videocam_off_white_48dp.png";
import screenShareOff from "../assets/outline_screen_share_white_48dp.png";
import leaveCall from "../assets/outline_call_end_white_48dp.png";
import chatIcon from "../assets/outline_chat_white_48dp.png";
import ideIcon from "../assets/programming-code-signs.png";
import ideIconWhite from "../assets/programming-code-signs-white.png";
import closeIcon from "../assets/close.png";
import sendIcon from "../assets/send-message.png";

import Time from "../components/Time";
import IdeMain from "../ide_components/IdeMain";

import { Slide, Zoom } from "react-reveal";
import Message from "../components/Message";

const Room = (props) => {
  const userVideo = useRef();
  const partnerVideo = useRef();
  const peerRef = useRef();
  const socketRef = useRef();
  const otherUser = useRef();
  const userStream = useRef();
  const senders = useRef([]);

  const sendChannel = useRef();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  //add
  const [peerJoined, setPeerJoined] = useState(false);
  //add
  const [hideCameraFlag, setHideCameraFlag] = useState(true);
  const [muteFlag, setMuteFlag] = useState(false);
  const [full, setFull] = useState(false);

  const [screenShareFlag, setScreenShareFlag] = useState(!true);
  const screenShareFlagRef = useRef();
  screenShareFlagRef.current = false;

  const [peerScreenShareFlag, setPeerScreenShareFlag] = useState(!true);
  const event = useRef();
  event.current = new Event("screen share");

  const [ideFlag, setIdeFlag] = useState(!true);
  const [chatFlag, setChatFlag] = useState(!true);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        userVideo.current.srcObject = stream;
        userStream.current = stream;

        userStream.current.getTracks()[0].enabled = false;

        socketRef.current = io.connect("/");
        socketRef.current.emit("join room", props.match.params.roomID);

        socketRef.current.on("other user", (userID) => {
          callUser(userID);
          otherUser.current = userID;
        });

        socketRef.current.on("user joined", (userID) => {
          otherUser.current = userID;
        });

        socketRef.current.on("room full", () => {
          setFull(!full);
          window.location.href = "https://intense-dawn-13733.herokuapp.com/";
        });

        socketRef.current.on("offer", handleRecieveCall);

        socketRef.current.on("answer", handleAnswer);

        socketRef.current.on("ice-candidate", handleNewICECandidateMsg);

        //add
        socketRef.current.on("user left", () => {
          if (peerRef.current) {
            peerRef.current.ontrack = null;
            peerRef.current.onicecandidate = null;
            peerRef.current.close();
            peerRef.current = null;
          }

          setPeerJoined(false);
          console.log("user left called");

          senders.current = [];
        });
        //add

        let leaveRoomButton = document.getElementById("leaveButton");
        leaveRoomButton.addEventListener("click", function () {
          let obj = {
            roomID: props.match.params.roomID,
            otherUser: otherUser.current,
          };
          socketRef.current.emit("leave room", obj);
          window.location.href = "https://intense-dawn-13733.herokuapp.com/";
        });

        socketRef.current.on("room full", () => {});

        //new
        // let screenShareButton = document.querySelector(
        //   `.${style.btnShareScreen}`
        // );
        document.addEventListener("screen share", () => {
          const payload = {
            target: otherUser.current,
            screenShareFlag: screenShareFlagRef.current,
          };
          console.log("screenshare-->", payload);

          socketRef.current.emit("sharescreen status", payload);
        });

        socketRef.current.on("sharescreen status", (data) => {
          // console.log("data recived");
          // alert(data);
          setPeerScreenShareFlag(data);
          //* new
        });
      });
  }, []);

  // useEffect(() => {
  //   console.log("screenshare-->", socketRef.current);
  //   if (socketRef.current) {

  //   }
  // }, [screenShareFlag]);

  function callUser(userID) {
    peerRef.current = createPeer(userID);
    userStream.current
      .getTracks()
      .forEach((track) =>
        senders.current.push(
          peerRef.current.addTrack(track, userStream.current)
        )
      );

    //add
    sendChannel.current = peerRef.current.createDataChannel("sendChannel");
    sendChannel.current.onmessage = handleReceiveMessage;
    //add
  }

  //add
  function handleReceiveMessage(e) {
    const now = new Date();
    const time = date.format(now, "hh:mm A");
    setMessages((messages) => [
      ...messages,
      { isMy: false, value: e.data, time },
    ]);
  }
  //add

  function createPeer(userID) {
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.stunprotocol.org",
        },
        {
          urls: "turn:numb.viagenie.ca",
          credential: "muazkh",
          username: "webrtc@live.com",
        },
      ],
    });

    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

    return peer;
  }

  function handleNegotiationNeededEvent(userID) {
    peerRef.current
      .createOffer()
      .then((offer) => {
        return peerRef.current.setLocalDescription(offer);
      })
      .then(() => {
        const payload = {
          target: userID,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription,
        };
        socketRef.current.emit("offer", payload);
      })
      .catch((e) => console.log(e));
  }

  function handleRecieveCall(incoming) {
    peerRef.current = createPeer();

    // add
    peerRef.current.ondatachannel = (event) => {
      sendChannel.current = event.channel;
      sendChannel.current.onmessage = handleReceiveMessage;
    };
    // add

    const desc = new RTCSessionDescription(incoming.sdp);
    peerRef.current
      .setRemoteDescription(desc)
      .then(() => {
        userStream.current
          .getTracks()
          .forEach((track) =>
            senders.current.push(
              peerRef.current.addTrack(track, userStream.current)
            )
          );
      })
      .then(() => {
        return peerRef.current.createAnswer();
      })
      .then((answer) => {
        return peerRef.current.setLocalDescription(answer);
      })
      .then(() => {
        const payload = {
          target: incoming.caller,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription,
        };
        socketRef.current.emit("answer", payload);
      });
  }

  function handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp);
    peerRef.current.setRemoteDescription(desc).catch((e) => console.log(e));
  }

  function handleICECandidateEvent(e) {
    if (e.candidate) {
      const payload = {
        target: otherUser.current,
        candidate: e.candidate,
      };
      socketRef.current.emit("ice-candidate", payload);
    }
  }

  function handleNewICECandidateMsg(incoming) {
    const candidate = new RTCIceCandidate(incoming);

    peerRef.current.addIceCandidate(candidate).catch((e) => console.log(e));
  }

  function handleTrackEvent(e) {
    //add
    setPeerJoined(true);
    //add
    partnerVideo.current.srcObject = e.streams[0];
  }

  function shareScreen() {
    // let screenShareButton = document.querySelector(`.${style.btnShareScreen}`);
    navigator.mediaDevices.getDisplayMedia({ cursor: true }).then((stream) => {
      const screenTrack = stream.getTracks()[0];

      console.log("senders.current is: ", senders.current);
      setScreenShareFlag(true);
      screenShareFlagRef.current = true;
      document.dispatchEvent(event.current);
      senders.current
        .find((sender) => sender.track.kind === "video")
        .replaceTrack(screenTrack);
      screenTrack.onended = function () {
        setScreenShareFlag(!true);
        screenShareFlagRef.current = !true;
        document.dispatchEvent(event.current);
        senders.current
          .find((sender) => sender.track.kind === "video")
          .replaceTrack(userStream.current.getTracks()[1]);
      };
    });
  }

  function handleChange(e) {
    setText(e.target.value);
  }

  function sendMessage(e) {
    console.log(e.keyCode);
    if ((e.type === "click" || e.keyCode === 13) && text != "" && peerJoined) {
      sendChannel.current.send(text);
      const now = new Date();
      const time = date.format(now, "hh:mm A");
      setMessages((messages) => [
        ...messages,
        { isMy: true, value: text, time },
      ]);
      setText("");
    }
  }

  function hideCamera() {
    if (hideCameraFlag) {
      userStream.current.getTracks()[1].enabled = false;
    } else {
      userStream.current.getTracks()[1].enabled = true;
    }

    setHideCameraFlag(!hideCameraFlag);
  }

  function mute() {
    if (muteFlag) {
      userStream.current.getTracks()[0].enabled = false;
    } else {
      userStream.current.getTracks()[0].enabled = true;
    }

    setMuteFlag(!muteFlag);
  }

  function renderMessage(message, index) {
    if (message.yours) {
      return (
        <div key={index}>
          <p>{message.value}</p>
        </div>
      );
    }

    return (
      <div key={index}>
        <p>{message.value}</p>
      </div>
    );
  }

  return (
    <div className={style.container}>
      <div style={{ position: "absolute", zIndex: "2" }}>
        <Slide right collapse when={ideFlag} duration={600}>
          <div className={style.ideContainer}>
            <IdeMain />
          </div>
        </Slide>
      </div>
      <div className={style.videoContainer}>
        <div className={style.videoSubContainer}>
          {peerJoined && (
            <video
              // controls
              // style={{ height: 500, width: 500 }}
              autoPlay
              ref={partnerVideo}
              className={`${style.peerVideo} ${
                peerScreenShareFlag && style.changePeerVideo
              }`}
            />
          )}
          <video
            muted
            // controls
            // style={{ height: 500, width: 500, background: "white" }}
            autoPlay
            ref={userVideo}
            className={`${style.userVideo} ${
              peerJoined && style.changeUserVideo
            }`}
          />
        </div>

        <div className={`${style.messageContainer} ${chatFlag && style.enter}`}>
          <div className={style.messageHeader}>
            <p className={style.chatHeading}>Chat</p>
            <img
              src={closeIcon}
              alt="close chat"
              className={style.closeChat}
              onClick={() => setChatFlag(!chatFlag)}
            />
          </div>

          <div className={style.chatMainContainer} id="abc">
            {/* <Message
              isMy={true}
              message="jkhskdhfhs sdhjfhjksd jshjkfd sjdklfjsdl "
              time="lodu"
            /> */}
            {[...messages].reverse().map((message) => (
              <Message
                isMy={message.isMy}
                message={message.value}
                time={message.time}
              />
            ))}
          </div>
          <Zoom collapse delay={1} when={chatFlag} duration={100}>
            <div className={style.chatFooterContainer}>
              <input
                type="text"
                className={style.chatInput}
                placeholder="Send message"
                onChange={handleChange}
                value={text}
                id="chatIn"
                // onKeyDownCapture={sendMessage}
              />
              <img
                src={sendIcon}
                alt="send messsage"
                className={`${style.btnSend} ${
                  (text === "" || !peerJoined) && style.btnDisable
                }`}
                // className={style.btnSend}
                onClick={sendMessage}
              />
            </div>
          </Zoom>
        </div>
      </div>

      <div className={style.footer}>
        <div className={style.leftPartFooter}>
          <Time />
        </div>
        <div className={style.controlContainer}>
          <img
            onClick={shareScreen}
            className={`${style.btnShareScreen}  ${
              screenShareFlag && style.red
            }`}
            src={screenShareOff}
          ></img>
          <img
            onClick={hideCamera}
            className={`${style.btnHideCamera} ${!hideCameraFlag && style.red}`}
            src={hideCameraFlag ? videoOn : videoOff}
          ></img>
          <img
            onClick={mute}
            className={`${style.btnMute} ${!muteFlag && style.red}`}
            src={!muteFlag ? micOff : micOn}
          ></img>
          <img
            id="leaveButton"
            className={style.btnLeaveCall}
            src={leaveCall}
          ></img>
        </div>

        <div className={style.rightPartFooter}>
          <img
            src={chatIcon}
            alt="chat"
            className={style.btnChat}
            onClick={() => {
              setChatFlag(!chatFlag);
              const el = document.getElementById("chatIn");
              el.focus();
            }}
          />
          <img
            src={!ideFlag ? ideIcon : ideIconWhite}
            alt="ide"
            className={`${style.btnIde} ${ideFlag && style.changeBtnIde}`}
            onClick={() => setIdeFlag(!ideFlag)}
          />
        </div>
      </div>

      {/* <div style={{ margin: "40px" }}>
        <div className="message-box">
          <div>{messages.map(renderMessage)}</div>
        </div>
        <input
          value={text}
          type="text"
          placeholder="say something..."
          onChange={handleChange}
        ></input>
        <button onClick={sendMessage}>Send</button>
      </div> */}
    </div>
  );
};

export default Room;
