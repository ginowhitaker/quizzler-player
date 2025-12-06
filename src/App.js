import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://quizzler-production.up.railway.app';

export default function PlayerApp() {
  const [socket, setSocket] = useState(null);
  const [screen, setScreen] = useState('join');
  const [gameCode, setGameCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [approvalRequest, setApprovalRequest] = useState(null);
  const [role, setRole] = useState(null);
  const [teams, setTeams] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showCategories, setShowCategories] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [venueSpecials, setVenueSpecials] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [questionNumber, setQuestionNumber] = useState(0);
  const [isVisual, setIsVisual] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [visualAnswers, setVisualAnswers] = useState(['', '', '', '', '', '']);
  const [isFinal, setIsFinal] = useState(false);
  const [finalCategory, setFinalCategory] = useState('');
  const [wager, setWager] = useState(0);
  const [wagerSubmitted, setWagerSubmitted] = useState(false);
  const [answer, setAnswer] = useState('');
  const [selectedConfidence, setSelectedConfidence] = useState(null);
  const [usedConfidences, setUsedConfidences] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState(null); // null, 'correct', or 'incorrect'
  const submittedRef = useRef(false);
  // eslint-disable-next-line no-unused-vars
  const [timerDuration, setTimerDuration] = useState(0); // Total timer duration in seconds
  const [timeRemaining, setTimeRemaining] = useState(0); // Current countdown
  const [timerActive, setTimerActive] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const [standings, setStandings] = useState([]);

// Removed auto-load of saved game info - fields should be clear on app load

useEffect(() => {
  const newSocket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
    // REMOVED: forceNew: true
  });
  
  setSocket(newSocket);
  
  newSocket.on('connect', () => {
    console.log('Connected to backend');
    
    // If reconnecting mid-game, rejoin the game room
    if (gameCode && teamName && playerName) {
      console.log('Rejoining game:', gameCode, 'as team:', teamName, 'player:', playerName);
      newSocket.emit('player:join', { gameCode, teamName, playerName });
      
      // Sync game state from backend
      fetch(`${BACKEND_URL}/api/game/${gameCode}`)  // FIXED: Added opening (
        .then(res => res.json())
        .then(gameData => {
          console.log('Synced player game state:', gameData);
          
          // Find this team's data
          const myTeam = gameData.teams?.find(t => t.name === teamName);
          if (myTeam) {
            setUsedConfidences(myTeam.usedConfidences || []);
            
            // Check if there's feedback or a current question waiting
            const currentQ = gameData.currentQuestion;
            if (currentQ && currentQ.number) {
              const questionKey = `q${currentQ.number}`;
              const myAnswer = myTeam.answers?.[questionKey];
              
              if (myAnswer?.marked) {
                // Show feedback if answer was already marked
                setAnswerResult(myAnswer.correct ? 'correct' : 'incorrect');
                setScreen('feedback');
              } else if (myAnswer && !myAnswer.marked) {
                // Waiting for host to review
                setSubmitted(true);
                setScreen('waiting');
              }
            }
          }
        })
        .catch(err => console.error('Failed to sync player state:', err));
    }
  });
  
  newSocket.on('disconnect', () => {
    console.log('Disconnected from backend - attempting to reconnect...');
  });
  
  newSocket.on('reconnect', (attemptNumber) => {
    console.log('Reconnected after', attemptNumber, 'attempts');
  });
  
  newSocket.on('error', (error) => {
    console.error('Socket error:', error);
    alert(error.message);
  });
  
  return () => newSocket.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  useEffect(() => {
    if (!socket) return;

socket.on('player:joined', (data) => {
  console.log('Joined game:', data);
  setRole(data.role); // ADD THIS LINE
  setTeams(data.teams);
  setCategories(data.categories || []); // Store categories
  // eslint-disable-next-line no-unused-vars
  const myTeam = data.teams.find(t => t.name === teamName);
  setUsedConfidences(data.usedConfidences || []);
  setVenueName(data.venueName || '');
  setVenueSpecials(data.venueSpecials || '');
  
  // Save to localStorage for easy rejoin
  localStorage.setItem('quizzler_gameCode', data.gameCode);
  localStorage.setItem('quizzler_teamName', teamName);
  localStorage.setItem('quizzler_playerName', playerName);
  
  if (data.currentQuestion) {
  setCurrentQuestion(data.currentQuestion.text);
  setQuestionNumber(data.currentQuestion.number);
  setIsFinal(data.currentQuestion.isFinal);
  
  // Check if it's a visual round
if (data.currentQuestion.type === 'visual') {
  setIsVisual(true);
  setImageUrl(data.currentQuestion.imageUrl || '');
} else {
  setIsVisual(false);
  setImageUrl(null);
}
  
  // Check if team already submitted answer - show waiting screen instead of question input
  if (data.answerAlreadySubmitted) {
    setSubmitted(true);
    submittedRef.current = true;
  }
  
  setScreen('question');
} else {
  setScreen('waiting');
}
});

socket.on('player:captainChanged', (data) => {
  console.log('Captain changed:', data);
  
  // Check if THIS socket is the new captain
  if (socket.id === data.newCaptainSocketId) {
    setRole('captain');
    setUsedConfidences(data.usedConfidences || []); // Update used confidences
    alert('⭐ You are now the team captain!');
  } else {
    setRole('viewer');
  }
});

// NEW: Waiting for captain approval
socket.on('player:waitingApproval', (data) => {
  console.log('Waiting for approval:', data);
  setScreen('waitingApproval');
});

// NEW: Approval granted
socket.on('player:approved', (data) => {
  console.log('Approved!', data);
  // Re-trigger join now that we're approved
  socket.emit('player:join', { 
    gameCode: data.gameCode, 
    teamName: data.teamName,
    playerName: data.playerName
  });
});

// NEW: Approval denied
socket.on('player:denied', (data) => {
  alert(`Request denied: ${data.message}`);
  setScreen('join');
});

// NEW: Captain receives approval request
socket.on('player:approvalRequest', (data) => {
  setApprovalRequest(data);
});

    socket.on('player:questionReceived', (data) => {
      // If this is a resent question, check if it's for this team
      if (data.resent && data.forTeam && data.forTeam !== teamName) {
        console.log(`Ignoring resent question - it's for ${data.forTeam}, not ${teamName}`);
        return; // Ignore questions resent to other teams
      }
      
      setCurrentQuestion(data.question);
      setQuestionNumber(data.questionNumber);
      setIsFinal(data.isFinal);
      setIsVisual(data.type === 'visual');
      setImageUrl(data.imageUrl || null);
      setAnswer('');
      setVisualAnswers(['', '', '', '', '', '']);
      setSelectedConfidence(null);
      setSubmitted(false);
      setAnswerResult(null);
      
      // If this is a resent question, update usedConfidences to restore the point
      if (data.resent && data.usedConfidences !== undefined) {
        setUsedConfidences(data.usedConfidences);
      }
      
      // Initialize timer if present
      if (data.timerDuration && data.timerDuration > 0) {
        setTimerDuration(data.timerDuration);
        setTimeRemaining(data.timerDuration);
        setTimerActive(true);
      } else {
        setTimerActive(false);
      }
      
      setScreen('question');
    });

socket.on('player:answerMarked', (data) => {
  console.log('Answer marked event received:', data);
  
  // Handle visual questions differently
  if (data.isVisual) {
    setAnswerResult({
      isVisual: true,
      visualResults: data.visualResults,
      pointsEarned: data.pointsEarned
    });
    // For visual questions, submittedAnswer is an array
    if (data.submittedAnswer) {
      let parsedAnswers;
      try {
        parsedAnswers = JSON.parse(data.submittedAnswer);
      } catch {
        // If not JSON, treat as comma-separated string
        parsedAnswers = data.submittedAnswer.split(',').map(a => a.trim());
      }
      setVisualAnswers(parsedAnswers);
    }
  } else {
    setAnswerResult(data.correct ? 'correct' : 'incorrect');
    // For regular questions, store the submitted answer so viewers can see it
    if (data.submittedAnswer) {
      setAnswer(data.submittedAnswer);
    }
  }
  
  setCorrectAnswer(data.correctAnswer || '');
  setScreen('results');
  submittedRef.current = false;
});

// Handle when captain submits answer - notify entire team (captain + viewers)
socket.on('player:answerSubmitted', (data) => {
  console.log('Answer submitted by captain:', data);
  setSubmitted(true);
  setSelectedConfidence(data.confidence);
  submittedRef.current = true;
});

    socket.on('player:scoresUpdated', (data) => {
  setTeams(data.teams);
});

// Handle answer corrections from host (via team history)
    socket.on('player:answerCorrected', (data) => {
      console.log('Answer corrected by host:', data);
      console.log('Current answerResult before:', answerResult);
      
      // Always update answerResult - works for both 'question' and 'results' screens
      if (data.visualIndex !== undefined) {
        // Visual question - update specific answer
        setAnswerResult(prev => {
          const newResult = {
            ...prev,
            visualResults: prev.visualResults.map((result, idx) => 
              idx === data.visualIndex ? data.correct : result
            )
          };
          console.log('Updated visual result:', newResult);
          return newResult;
        });
      } else {
        // Regular or final question - update correct/incorrect
        const newResult = data.correct ? 'correct' : 'incorrect';
        console.log('Setting answerResult to:', newResult);
        setAnswerResult(newResult);
      }
    });
    socket.on('player:gameCompleted', (data) => {
      setTeams(data.teams);
      setScreen('completed');
    });
    
    socket.on('player:standingsReceived', (data) => {
      console.log('Standings received:', data.standings);
      setStandings(data.standings);
      setShowStandings(true);
      // Auto-hide after 8 seconds
      setTimeout(() => {
        setShowStandings(false);
      }, 8000);
    });
    
socket.on('player:finalCategoryReceived', (data) => {
  setFinalCategory(data.category);
  setWager(0);
  setWagerSubmitted(false);
  setScreen('finalWager');
});

socket.on('player:finalQuestionReceived', (data) => {
  setCurrentQuestion(data.question);
  setIsFinal(true);
  setAnswer('');
  setSelectedConfidence(wager); // Use submitted wager
  setSubmitted(false);
  setAnswerResult(null);
  setScreen('question');
});

    return () => {
      socket.off('player:joined');
      socket.off('player:questionReceived');
      socket.off('player:answerSubmitted');
      socket.off('player:answerMarked');
      socket.off('player:scoresUpdated');
      socket.off('player:answerCorrected');
      socket.off('player:gameCompleted');
      socket.off('player:standingsReceived');
      socket.off('player:finalCategoryReceived');
      socket.off('player:finalQuestionReceived');
      socket.off('player:captainChanged');
      socket.off('player:waitingApproval');
      socket.off('player:approved');
      socket.off('player:denied');
      socket.off('player:approvalRequest');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, teamName, isFinal, selectedConfidence]);

  // Timer countdown
  useEffect(() => {
    if (!timerActive || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, timeRemaining]);

const joinGame = () => {
  if (!gameCode || !teamName || !playerName) {
    alert('Please enter game code, team name, and your name');
    return;
  }
  socket.emit('player:join', { 
    gameCode: gameCode.toUpperCase(), 
    teamName,
    playerName  // ADD THIS
  });
};

  const submitAnswer = () => {
    if (isVisual) {
      // Visual question - check all 6 answers are filled, no confidence needed
      if (visualAnswers.some(ans => !ans.trim())) {
        alert('Please answer all 6 parts');
        return;
      }
      
      socket.emit('player:submitAnswer', {
        gameCode: gameCode.toUpperCase(),
        teamName,
        answerText: visualAnswers, // Send array
        confidence: 0 // Visual questions don't use confidence
      });
      
      setSubmitted(true);
      
    } else {
      // Regular question logic
      if (!answer) {
        alert('Please enter an answer');
        return;
      }
      
      if (!isFinal) {
        if (!selectedConfidence || selectedConfidence < 1 || selectedConfidence > 15) {
          alert('Please select a confidence value');
          return;
        }
        if (usedConfidences.includes(selectedConfidence)) {
          alert('You have already used this confidence value');
          return;
        }
      } else {
        if (selectedConfidence === null || selectedConfidence < 0 || selectedConfidence > 30) {
          alert('Please select a wager between 0 and 30');
          return;
        }
      }

      socket.emit('player:submitAnswer', {
        gameCode: gameCode.toUpperCase(),
        teamName,
        answerText: answer,
        confidence: selectedConfidence
      });
      
      if (!isFinal) {
        setUsedConfidences(prev => [...prev, selectedConfidence]);
      }
      setSubmitted(true);
    }
  };
    
  const submitWager = () => {
    if (wager < 0 || wager > 30) {
      alert('Wager must be between 0 and 30 points');
      return;
    }
    
    setSelectedConfidence(wager);
    setWagerSubmitted(true);
    
    socket.emit('player:submitWager', {
      gameCode: gameCode.toUpperCase(),
      teamName,
      wager
    });
  };
  const getLeaderboard = () => {
    return [...teams].sort((a, b) => b.score - a.score);
  };

  const getOrdinal = () => {
    const leaderboard = getLeaderboard();
    const index = leaderboard.findIndex(t => t.name === teamName);
    if (index === -1) return '?';
    const place = index + 1;
    if (place === 1) return '1st';
    if (place === 2) return '2nd';
    if (place === 3) return '3rd';
    return place + 'th';
  };

  // Styles
  const sunburstBg = {
  backgroundImage: 'url(https://quizzlertrivia.com/img/quizzler-background.png)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundAttachment: 'fixed'
};

  const orangeColor = '#FF6600';
  const tealColor = '#286586';
  const greenColor = '#00AA00';
  const redColor = '#C60404';
  const blueButton = '#32ADE6';

// Logo Component
  const Logo = () => (
    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
      <img 
        src="https://quizzlertrivia.com/img/quizzler_logo.png" 
        alt="Quizzler" 
        style={{ height: '30px', width: 'auto' }}
      />
    </div>
  );

  // Approval Banner Component - Shows when captain receives join request
  const ApprovalBanner = () => {
    if (role !== 'captain' || !approvalRequest) return null;
    
    return (
      <div style={{ 
        maxWidth: '600px', 
        margin: '0 auto 20px auto',
        background: '#FFF9C4',
        border: '3px solid #FFB300',
        borderRadius: '15px',
        padding: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        position: 'relative',
        zIndex: 1000
      }}>
        <h3 style={{ color: '#F57C00', fontSize: '18px', marginBottom: '10px', margin: 0 }}>
          👋 Join Request
        </h3>
        <p style={{ color: '#333', marginBottom: '15px', margin: '10px 0' }}>
          <strong>{approvalRequest.playerName}</strong> wants to join your team as a viewer
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              socket.emit('player:approveViewer', {
                gameCode,
                teamName,
                requestSocketId: approvalRequest.requestSocketId,
                playerName: approvalRequest.playerName
              });
              setApprovalRequest(null);
            }}
            style={{ 
              flex: 1,
              padding: '12px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ✓ Approve
          </button>
          <button
            onClick={() => {
              socket.emit('player:denyViewer', {
                requestSocketId: approvalRequest.requestSocketId,
                playerName: approvalRequest.playerName,
                teamName
              });
              setApprovalRequest(null);
            }}
            style={{ 
              flex: 1,
              padding: '12px',
              background: '#F44336',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ✗ Deny
          </button>
        </div>
      </div>
    );
  };

  // Categories Modal Component - Shows list of question categories
  const CategoriesModal = () => {
    if (!showCategories || categories.length === 0) return null;
    
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }} onClick={() => setShowCategories(false)}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '30px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
        }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: tealColor, fontFamily: 'Gabarito, sans-serif' }}>Question Categories</h2>
            <button 
              onClick={() => setShowCategories(false)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0',
                color: '#666'
              }}
            >
              ✕
            </button>
          </div>
          
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
            Plan your confidence strategy! Questions 1-15 (excludes Visual Round and Final Question)
          </p>
          
          <div style={{ display: 'grid', gap: '10px' }}>
            {categories.map((cat) => (
              <div key={cat.number} style={{
                background: '#f5f5f5',
                padding: '15px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '15px'
              }}>
                <div style={{
                  background: orangeColor,
                  color: 'white',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {cat.number}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#333',
                  fontWeight: '500'
                }}>
                  {cat.category}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Floating Categories Button - Shows on all game screens
  const CategoriesButton = () => {
    // Only show if we have categories and we're in an active game screen
    if (categories.length === 0 || screen === 'join' || screen === 'waitingApproval' || screen === 'completed') {
      return null;
    }
    
    return (
      <>
        <CategoriesModal />
        <button
          onClick={() => setShowCategories(true)}
          style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            background: tealColor,
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: '0px 10px',
            fontSize: '40px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'Gabarito, sans-serif'
          }}
        >
           ⚙
        </button>
      </>
    );
  };

  // Standings Overlay Component
  const StandingsOverlay = () => {
    if (!showStandings) return null;
    
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '600px',
          width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ fontSize: '64px', marginBottom: '10px' }}>🏆</div>
            <h2 style={{ 
              fontFamily: 'Gabarito, sans-serif', 
              fontSize: '36px', 
              color: tealColor, 
              margin: '0 0 10px 0' 
            }}>
              Current Standings
            </h2>
          </div>

          <div>
            {standings.map((team, idx) => {
              const isMyTeam = team.name === teamName;
              const isFirst = idx === 0;
              
              return (
                <div key={team.name} style={{ 
                  background: isFirst ? '#FFF9C4' : isMyTeam ? '#E3F2FD' : '#f5f5f5',
                  border: isFirst ? `4px solid ${orangeColor}` : isMyTeam ? `3px solid ${tealColor}` : 'none',
                  padding: '20px',
                  borderRadius: '15px',
                  marginBottom: '15px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ 
                      fontSize: '28px', 
                      fontWeight: 'bold', 
                      color: '#999',
                      minWidth: '40px'
                    }}>
                      #{idx + 1}
                    </span>
                    {isFirst && <span style={{ fontSize: '32px' }}>👑</span>}
                    <div>
                      <div style={{ 
                        fontSize: '22px', 
                        fontWeight: 'bold', 
                        color: tealColor,
                        fontFamily: 'Gabarito, sans-serif'
                      }}>
                        {team.name}
                      </div>
                      {isMyTeam && (
                        <div style={{ 
                          color: orangeColor, 
                          fontWeight: 'bold',
                          fontSize: '14px'
                        }}>
                          Your Team
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: '36px', 
                    fontWeight: 'bold', 
                    color: orangeColor,
                    fontFamily: 'Gabarito, sans-serif'
                  }}>
                    {team.score}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setShowStandings(false)}
            style={{
              width: '100%',
              marginTop: '20px',
              padding: '15px',
              background: tealColor,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: 'Gabarito, sans-serif'
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  // Join Screen
  if (screen === 'join') {
    return (
      <div style={{ ...sunburstBg, minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '450px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
         <img 
  src="https://quizzlertrivia.com/img/quizzler_logo.png" 
  alt="Quizzler" 
  style={{ height: '30px', width: 'auto', display: 'block', margin: '0 auto 10px' }}
/>
          <p style={{ color: tealColor, textAlign: 'center', fontSize: '18px', marginBottom: '30px' }}>Join the Game</p>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Gabarito, sans-serif' }}>Game Code</label>
            <input
              type="tel"
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="Enter code"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              maxLength={4}
              style={{ width: '90%', padding: '15px', fontSize: '24px', textAlign: 'center', border: `2px solid ${tealColor}`, borderRadius: '10px', fontFamily: 'Gabarito, sans-serif', fontWeight: 'bold' }}
            />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Gabarito, sans-serif' }}>Team Name</label>
            <input
              type="text"
              placeholder="Your team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              style={{ width: '90%', padding: '15px', fontSize: '18px', border: `2px solid ${tealColor}`, borderRadius: '10px' }}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Gabarito, sans-serif' }}>Your Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              style={{ width: '90%', padding: '15px', fontSize: '18px', border: `2px solid ${tealColor}`, borderRadius: '10px' }}
            />
          </div>
          
          <button
            onClick={joinGame}
            style={{ width: '100%', padding: '18px', fontSize: '20px', fontWeight: 'bold', background: blueButton, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' }}
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

// Waiting for Captain Approval Screen
  if (screen === 'waitingApproval') {
    return (
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
        <Logo />
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ background: 'white', borderRadius: '15px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>⏳</div>
            <h2 style={{ color: tealColor, fontSize: '28px', marginBottom: '15px', fontFamily: 'Gabarito, sans-serif' }}>
              Waiting for Approval
            </h2>
            <p style={{ color: '#666', fontSize: '18px', marginBottom: '10px' }}>
              {playerName}, you've requested to join <strong>{teamName}</strong>
            </p>
            <p style={{ color: '#666', fontSize: '16px' }}>
              The team captain will approve your request shortly...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Waiting Screen
  if (screen === 'waiting') {
    // eslint-disable-next-line no-unused-vars
    const leaderboard = getLeaderboard();
    const myScore = teams.find(t => t.name === teamName)?.score || 0;

    return (
      <>
      <StandingsOverlay />
      <CategoriesButton />
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
        <Logo />
        <ApprovalBanner />

        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
{/* Header */}
<div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <h2 style={{ color: orangeColor, fontSize: '28px', margin: '0', fontFamily: 'Gabarito, sans-serif' }}>{teamName}</h2>
        {role && (
          <span style={{
            background: role === 'captain' ? '#FFD700' : '#E0E0E0',
            color: role === 'captain' ? '#000' : '#666',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            {role === 'captain' ? '⭐ Captain' : '👁️ Viewer'}
          </span>
        )}
      </div>
      <p style={{ color: tealColor, margin: '5px 0 0 0' }}>Game: <strong>{gameCode}</strong></p>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '14px', color: tealColor }}>Your Score</div>
      <div style={{ fontSize: '36px', fontWeight: 'bold', color: tealColor }}>{myScore}</div>
      <div style={{ fontSize: '14px', color: tealColor }}>{getOrdinal()} Place</div>
    </div>
  </div>
</div>

          {/* Waiting Message */}
<div style={{ background: 'white', borderRadius: '15px', padding: '40px', textAlign: 'center', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
  <h2 style={{ color: tealColor, fontSize: '24px', marginBottom: '10px' }}>
    {questionNumber === 0 ? 'Waiting for Game to Start...' : 'Waiting for Next Question...'}
  </h2>
  <p style={{ color: '#666', fontSize: '16px' }}>
    {questionNumber === 0 ? 'The host will start the game shortly' : 'The host will push the question when ready'}
  </p>
</div>

{/* Rules - Show before first question */}
{questionNumber === 0 && (
  <div style={{ background: 'white', border: '3px solid ' + tealColor, borderRadius: '15px', padding: '30px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
    <h3 style={{ color: tealColor, fontSize: '22px', marginBottom: '12px', fontFamily: 'Gabarito, sans-serif', textAlign: 'center', fontWeight: 'bold' }}>
    QUIZZLER TRIVIA RULES
    </h3>
    <ul style={{ fontSize: '16px', lineHeight: '1.4', color: '#333' }}>
      <li style={{ marginBottom: '8px' }}>
        15 Questions, plus a Visual Round and a Final Question
      </li>
      <li style={{ marginBottom: '8px' }}>
       Regular Questions worth between 1-15 points
      </li>
      <li style={{ marginBottom: '8px' }}>
        Assign Confidence Points for each question
      </li>
      <li style={{ marginBottom: '8px' }}>
        Visual Round: Identify 6 images worth 1 point to earn up to 6 points
      </li>
      <li style={{ marginBottom: '8px' }}>
        Final Round Question - wager up to 30 points
      </li>
      <li style={{ marginBottom: '8px' }}>
        Final Round wager will add or deduct points from your final score based on correctness
      </li>
      <li style={{ marginBottom: '8px' }}>
        Teams with the most points at the end wins the game
      </li>
      </ul>
  </div>
)}

{/* Venue Specials - Show before first question */}
{questionNumber === 0 && venueSpecials && (
  <div style={{ background: '#FFF9C4', border: '3px solid #FFB300', borderRadius: '15px', padding: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
    <h3 style={{ color: '#F57C00', fontSize: '22px', marginBottom: '15px', fontFamily: 'Gabarito, sans-serif', textAlign: 'center' }}>
      Tonight's Specials at {venueName}
    </h3>
    <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#333', whiteSpace: 'pre-wrap', textAlign: 'center' }}>
      {venueSpecials}
    </p>
  </div>
)}

{/* Leaderboard - Hidden during game
<div style={{ background: 'white', borderRadius: '15px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
  <h3 style={{ color: tealColor, fontSize: '20px', marginBottom: '15px' }}>🏆 Leaderboard</h3>
  {leaderboard.map((team, idx) => (
    <div key={team.name} style={{ 
      background: team.name === teamName ? '#FFF3E0' : '#f5f5f5', 
      padding: '15px', 
      borderRadius: '10px', 
      marginBottom: '10px',
      border: team.name === teamName ? `3px solid ${orangeColor}` : 'none',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#999' }}>#{idx + 1}</span>
        <span style={{ fontSize: '18px', fontWeight: team.name === teamName ? 'bold' : 'normal', color: tealColor }}>{team.name}</span>
      </div>
      <span style={{ fontSize: '24px', fontWeight: 'bold', color: orangeColor }}>{team.score}</span>
    </div>
  ))}
</div>
*/}
        </div>
      </div>
      </>
    );
  }
// Final Wager Screen
  if (screen === 'finalWager') {
    const myScore = teams.find(t => t.name === teamName)?.score || 0;

    return (
      <>
      <StandingsOverlay />
      <CategoriesButton />
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
      <Logo />
      <ApprovalBanner />
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', color: tealColor }}>FINAL QUESTION</div>
                <h2 style={{ color: orangeColor, fontSize: '24px', margin: '5px 0 0 0', fontFamily: 'Gabarito, sans-serif' }}>{teamName}</h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', color: tealColor }}>Current Score</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: tealColor }}>{myScore}</div>
              </div>
            </div>
          </div>

          {/* Category Display */}
          <div style={{ background: '#FFF9C4', border: `4px solid ${orangeColor}`, borderRadius: '15px', padding: '40px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', color: tealColor, marginBottom: '10px' }}>Category</div>
            <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: orangeColor, margin: 0, fontFamily: 'Gabarito, sans-serif' }}>{finalCategory}</h2>
          </div>

          {!wagerSubmitted ? (
            <div style={{ background: 'white', borderRadius: '15px', padding: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', position: 'relative' }}>
              {/* Viewer Overlay */}
              {role === 'viewer' && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(255,255,255,0.95)',
                  borderRadius: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '10px',
                  zIndex: 10
                }}>
                  <div style={{ fontSize: '48px' }}>👁️</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: tealColor }}>Viewing Only</div>
                  <div style={{ fontSize: '14px', color: '#666', textAlign: 'center', padding: '0 20px' }}>
                    Team captain is setting the wager...
                  </div>
                </div>
              )}

              <h3 style={{ color: tealColor, fontSize: '22px', marginBottom: '20px', textAlign: 'center' }}>How confident are you?</h3>
              <p style={{ color: '#666', textAlign: 'center', marginBottom: '20px' }}>Wager up to 30 points!</p>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '10px', fontSize: '18px', fontFamily: 'Gabarito, sans-serif' }}>Your Wager</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={wager}
                  onChange={(e) => setWager(parseInt(e.target.value) || 0)}
                  disabled={role === 'viewer'}
                  style={{ width: '90%', padding: '20px', fontSize: '32px', textAlign: 'center', border: `3px solid ${tealColor}`, borderRadius: '10px', fontWeight: 'bold', opacity: role === 'viewer' ? 0.5 : 1 }}
                />
              </div>

              <button
                onClick={submitWager}
                disabled={role === 'viewer'}
                style={{ width: '100%', padding: '20px', fontSize: '24px', fontWeight: 'bold', background: blueButton, color: 'white', border: 'none', borderRadius: '10px', cursor: role === 'viewer' ? 'not-allowed' : 'pointer', opacity: role === 'viewer' ? 0.5 : 1 }}
              >
                Submit Wager: {wager} Points
              </button>
            </div>
          ) : (
            <div style={{ background: '#C8E6C9', borderRadius: '15px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>✓</div>
              <h3 style={{ color: '#2E7D32', fontSize: '24px', marginBottom: '10px' }}>Wager Submitted!</h3>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#2E7D32', marginBottom: '10px' }}>{wager} Points</p>
              <p style={{ color: '#666', fontSize: '16px' }}>Waiting for the question to be revealed...</p>
            </div>
          )}
        </div>
      </div>
      </>
    );
  }
  // Question Screen
  if (screen === 'question' && !submitted) {
    const myScore = teams.find(t => t.name === teamName)?.score || 0;
    const confidenceOptions = isFinal 
      ? Array.from({ length: 31 }, (_, i) => i)
      : Array.from({ length: 15 }, (_, i) => i + 1);

    return (
      <>
      <StandingsOverlay />
      <CategoriesButton />
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
      <Logo />
      <ApprovalBanner />
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* Header */}
<div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '14px', color: tealColor }}>
        {isFinal ? 'FINAL QUESTION!' : isVisual ? 'VISUAL ROUND' : `Question ${questionNumber}`}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
        <h2 style={{ color: orangeColor, fontSize: '24px', margin: '0', fontFamily: 'Gabarito, sans-serif' }}>{teamName}</h2>
        {role && (
          <span style={{
            background: role === 'captain' ? '#FFD700' : '#E0E0E0',
            color: role === 'captain' ? '#000' : '#666',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            {role === 'captain' ? '⭐ Captain' : '👁️ Viewer'}
          </span>
        )}
      </div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '14px', color: tealColor }}>Score</div>
      <div style={{ fontSize: '32px', fontWeight: 'bold', color: tealColor }}>{myScore}</div>
    </div>
  </div>
</div>

          {/* Question */}
          <div style={{ background: isFinal ? '#FFF9C4' : 'white', border: isFinal ? `4px solid ${orangeColor}` : 'none', borderRadius: '15px', padding: '30px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <p style={{ fontSize: '22px', fontWeight: 'bold', color: tealColor, textAlign: 'center', margin: 0 }}>{currentQuestion}</p>
          </div>

          {/* Timer Display */}
          {timerActive && (
            <div style={{ 
              textAlign: 'center', 
              fontSize: '14px', 
              color: timeRemaining <= 30 ? '#C60404' : tealColor,
              marginBottom: '15px',
              fontWeight: 'bold'
            }}>
              ⏱️ Time Remaining: {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
            </div>
          )}

{/* Visual Image - Outside answer container so viewers can see it */}
{isVisual && imageUrl && (
  <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', textAlign: 'center' }}>
    <img 
      src={imageUrl} 
      alt="Visual Question"
      style={{ maxWidth: '100%', height: 'auto', borderRadius: '10px', border: '2px solid ' + tealColor }}
    />
  </div>
)}

{/* Answer Input */}
<div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', position: 'relative' }}>
  {/* Viewer Overlay */}
  {role === 'viewer' && (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(255,255,255,0.95)',
      borderRadius: '15px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '10px',
      zIndex: 10
    }}>
      <div style={{ fontSize: '48px' }}>👁️</div>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color: tealColor }}>Viewing Only</div>
      <div style={{ fontSize: '14px', color: '#666', textAlign: 'center', padding: '0 20px' }}>
        Team captain is answering...
      </div>
    </div>
  )}

  {isVisual ? (
    // 6 input fields for visual questions
    <div>
      <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '10px', fontSize: '18px', fontFamily: 'Gabarito, sans-serif' }}>Your Answers (1-6)</label>
      {[0, 1, 2, 3, 4, 5].map(idx => (
        <div key={idx} style={{ marginBottom: '10px' }}>
          <input
            type="text"
            value={visualAnswers[idx]}
            onChange={(e) => {
              const newAnswers = [...visualAnswers];
              newAnswers[idx] = e.target.value;
              setVisualAnswers(newAnswers);
            }}
            placeholder={`Answer ${idx + 1}`}
            disabled={role === 'viewer'}
            style={{ width: '90%', padding: '12px', fontSize: '16px', border: `2px solid ${tealColor}`, borderRadius: '8px', opacity: role === 'viewer' ? 0.5 : 1 }}
          />
        </div>
      ))}
    </div>
  ) : (
    // Regular single answer
    <>
      <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '10px', fontSize: '18px', fontFamily: 'Gabarito, sans-serif' }}>Your Answer</label>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer here..."
        disabled={role === 'viewer'}
        style={{ width: '90%', padding: '15px', fontSize: '16px', border: `2px solid ${tealColor}`, borderRadius: '10px', minHeight: '30px', resize: 'none', opacity: role === 'viewer' ? 0.5 : 1 }}
      />
    </>
  )}
</div>

{/* Confidence Grid - Only show for regular non-final questions */}
{!isFinal && !isVisual && (
  <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
    <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '15px', fontSize: '18px', fontFamily: 'Gabarito, sans-serif' }}>
      Confidence (1-15, each used once)
    </label>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
      {confidenceOptions.map(num => {
        const isUsed = usedConfidences.includes(num);
        const isSelected = selectedConfidence === num;
        
        return (
          <button
            key={num}
            onClick={() => !isUsed && role !== 'viewer' && setSelectedConfidence(num)}
            disabled={isUsed || role === 'viewer'}
            style={{
              padding: '10px',
              fontSize: '20px',
              fontWeight: 'bold',
              border: isSelected ? `3px solid ${orangeColor}` : '2px solid #ddd',
              borderRadius: '10px',
              background: isUsed ? '#e0e0e0' : isSelected ? '#FFE0B2' : 'white',
              color: isUsed ? '#999' : tealColor,
              cursor: (isUsed || role === 'viewer') ? 'not-allowed' : 'pointer',
              textDecoration: isUsed ? 'line-through' : 'none',
              opacity: role === 'viewer' ? 0.5 : 1
            }}
          >
            {num}
          </button>
        );
      })}
    </div>
  </div>
)}

{/* Visual Question Info */}
{isVisual && (
  <div style={{ background: '#E3F2FD', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', textAlign: 'center' }}>
    <p style={{ color: tealColor, fontSize: '16px', margin: 0, fontWeight: 'bold' }}>
      Visual Round: 1 point per correct answer (6 points possible)
    </p>
  </div>
)}
{/* Submit Button */}
<button
  onClick={submitAnswer}
  disabled={role === 'viewer'}
  style={{ 
    width: '100%', 
    padding: '20px', 
    fontSize: '22px', 
    fontWeight: 'bold', 
    background: role === 'viewer' ? '#ccc' : blueButton, 
    color: 'white', 
    border: 'none', 
    borderRadius: '15px', 
    cursor: role === 'viewer' ? 'not-allowed' : 'pointer', 
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    opacity: role === 'viewer' ? 0.6 : 1
  }}
>
{role === 'viewer' ? 'Captain is Answering...' : 'Submit Answer'}
</button>
        </div>
      </div>
      </>
    );
  }

  // Submitted Screen
  if (screen === 'question' && submitted) {
    const myScore = teams.find(t => t.name === teamName)?.score || 0;

    // Show result if answer was marked
    if (answerResult) {
      const isCorrect = answerResult === 'correct';
      return (
        <>
        <StandingsOverlay />
        <CategoriesButton />
        <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
        <Logo />
        <ApprovalBanner />
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
{/* Header */}
<div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '14px', color: tealColor }}>{isFinal ? 'FINAL QUESTION' : `Question ${questionNumber}`}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
        <h2 style={{ color: orangeColor, fontSize: '24px', margin: '0', fontFamily: 'Gabarito, sans-serif' }}>{teamName}</h2>
        {role && (
          <span style={{
            background: role === 'captain' ? '#FFD700' : '#E0E0E0',
            color: role === 'captain' ? '#000' : '#666',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            {role === 'captain' ? '⭐ Captain' : '👁️ Viewer'}
          </span>
        )}
      </div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '14px', color: tealColor }}>Score</div>
      <div style={{ fontSize: '32px', fontWeight: 'bold', color: tealColor }}>{myScore}</div>
    </div>
  </div>
</div>

            {/* Result Message */}
            <div style={{ background: 'white', borderRadius: '15px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '80px', marginBottom: '20px', color: isCorrect ? greenColor : redColor }}>
                {isCorrect ? '✓' : '✗'}
              </div>
              <h2 style={{ color: isCorrect ? greenColor : redColor, fontSize: '32px', marginBottom: '15px', fontFamily: 'Gabarito, sans-serif' }}>
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </h2>
              <p style={{ color: '#666', fontSize: '18px' }}>
                {isVisual 
                  ? (isCorrect ? 'All answers correct! +6 points' : 'Some answers incorrect')
                  : (isCorrect ? `+${selectedConfidence} points` : isFinal ? `-${selectedConfidence} points` : 'No points')
                }
              </p>
            </div>
          </div>
        </div>
      </>
      );
    }

    // Just submitted, waiting for host to mark
    return (
      <>
      <StandingsOverlay />
      <CategoriesButton />
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
      <Logo />
      <ApprovalBanner />
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
{/* Header */}
<div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '14px', color: tealColor }}>{isFinal ? 'FINAL QUESTION' : `Question ${questionNumber}`}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
        <h2 style={{ color: orangeColor, fontSize: '24px', margin: '0', fontFamily: 'Gabarito, sans-serif' }}>{teamName}</h2>
        {role && (
          <span style={{
            background: role === 'captain' ? '#FFD700' : '#E0E0E0',
            color: role === 'captain' ? '#000' : '#666',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            {role === 'captain' ? '⭐ Captain' : '👁️ Viewer'}
          </span>
        )}
      </div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '14px', color: tealColor }}>Score</div>
      <div style={{ fontSize: '32px', fontWeight: 'bold', color: tealColor }}>{myScore}</div>
    </div>
  </div>
</div>

           {/* Submitted Message */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h2 style={{ color: tealColor, fontSize: '28px', marginBottom: '15px', fontFamily: 'Gabarito, sans-serif' }}>Answer Submitted</h2>
            <p style={{ color: '#666', fontSize: '18px', marginBottom: '25px' }}>Waiting for host to review...</p>
            
            {selectedConfidence > 0 && (
              <div style={{ background: '#f5f5f5', borderRadius: '10px', padding: '20px', marginTop: '20px' }}>
                <div style={{ fontSize: '14px', color: tealColor, marginBottom: '5px' }}>
                  Your {isFinal ? 'Wager' : 'Confidence'}
                </div>
                <div style={{ fontSize: '48px', fontWeight: 'bold', color: orangeColor }}>{selectedConfidence}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      </>
    );
  }

// Results Screen - Show after scoring
if (screen === 'results') {
  const myScore = teams.find(t => t.name === teamName)?.score || 0;
  
  // Handle both regular and visual results
  const isVisualResult = typeof answerResult === 'object' && answerResult.isVisual;
  const pointsEarned = isVisualResult 
    ? answerResult.pointsEarned 
    : (answerResult === 'correct' ? selectedConfidence : 0);
  const wasCorrect = isVisualResult ? pointsEarned > 0 : answerResult === 'correct';
  
  return (
    <>
    <StandingsOverlay />
    <CategoriesButton />
    <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
    <Logo />
    <ApprovalBanner />
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', color: tealColor }}>Question {questionNumber}</div>
              <h2 style={{ color: orangeColor, fontSize: '24px', margin: '5px 0 0 0', fontFamily: 'Gabarito, sans-serif' }}>{teamName}</h2>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', color: tealColor }}>Score</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: tealColor }}>{myScore}</div>
            </div>
          </div>
        </div>

        {/* Result Banner */}
        <div style={{ 
          background: wasCorrect ? '#C8E6C9' : '#FFCDD2', 
          border: `4px solid ${wasCorrect ? '#4CAF50' : '#F44336'}`,
          borderRadius: '15px', 
          padding: '30px', 
          marginBottom: '20px', 
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>
            {isVisualResult ? '📸' : (wasCorrect ? '✓' : '✗')}
          </div>
          <h2 style={{ 
            fontSize: '28px', 
            margin: '0 0 10px 0', 
            color: wasCorrect ? '#2E7D32' : '#C62828',
            fontFamily: 'Gabarito, sans-serif'
          }}>
            {isVisualResult ? 'VISUAL ROUND SCORED' : (wasCorrect ? 'CORRECT!' : 'INCORRECT')}
          </h2>
          <p style={{ fontSize: '20px', margin: 0, color: wasCorrect ? '#2E7D32' : '#C62828' }}>
            +{pointsEarned} points {isVisualResult ? `(${pointsEarned} of 6 correct)` : ''}
          </p>
        </div>

        {/* Question */}
        <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '15px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '14px', color: tealColor, marginBottom: '10px', fontWeight: 'bold' }}>Question:</div>
          <p style={{ fontSize: '18px', margin: 0, color: '#333' }}>{currentQuestion}</p>
        </div>

        {/* Your Answer */}
<div style={{ background: '#FFF3E0', borderRadius: '15px', padding: '20px', marginBottom: '15px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
  <div style={{ fontSize: '14px', color: orangeColor, marginBottom: '10px', fontWeight: 'bold' }}>Your Answer{isVisualResult ? 's' : ''}:</div>
  {isVisualResult ? (
    <div>
      {visualAnswers.map((ans, idx) => (
        <div key={idx} style={{ marginBottom: '8px', padding: '8px', background: answerResult.visualResults[idx] ? '#E8F5E9' : '#FFEBEE', borderRadius: '5px' }}>
          <strong>#{idx + 1}:</strong> {ans} 
          <span style={{ marginLeft: '10px', color: answerResult.visualResults[idx] ? '#4CAF50' : '#F44336' }}>
            {answerResult.visualResults[idx] ? '✓' : '✗'}
          </span>
        </div>
      ))}
    </div>
  ) : (
    <p style={{ fontSize: '18px', margin: 0, color: '#333' }}>{answer}</p>
  )}
</div>

{/* Correct Answer */}
{correctAnswer && (
  <div style={{ background: '#E8F5E9', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
    <div style={{ fontSize: '14px', color: '#4CAF50', marginBottom: '10px', fontWeight: 'bold' }}>Correct Answer:</div>
    <p style={{ fontSize: '18px', margin: 0, color: '#333' }}>{correctAnswer}</p>
  </div>
)}

        {/* Waiting Message - Only show for non-final questions */}
        {!isFinal && (
          <div style={{ background: 'white', borderRadius: '15px', padding: '30px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>⏳</div>
            <p style={{ color: tealColor, fontSize: '18px', margin: 0 }}>Waiting for next question...</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
  // Game Complete
  if (screen === 'completed') {
    const leaderboard = getLeaderboard();

    return (
      <>
      <StandingsOverlay />
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '600px', width: '100%' }}>
          <Logo />        
          <div style={{ background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{ fontSize: '80px', marginBottom: '10px' }}>🏆</div>
              <h1 style={{ fontFamily: 'Gabarito, sans-serif', fontSize: '42px', color: orangeColor, margin: '0 0 10px 0' }}>Game Over!</h1>
              <p style={{ color: tealColor, fontSize: '20px' }}>Final Results</p>
            </div>

            <div>
              {leaderboard.map((team, idx) => {
                const isWinner = idx === 0;
                const isMyTeam = team.name === teamName;
                
                return (
                  <div key={team.name} style={{ 
                    background: isWinner ? '#FFF9C4' : isMyTeam ? '#E3F2FD' : '#f5f5f5',
                    border: isWinner ? `4px solid ${orangeColor}` : isMyTeam ? `3px solid ${tealColor}` : 'none',
                    padding: '20px',
                    borderRadius: '15px',
                    marginBottom: '15px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      {isWinner && <span style={{ fontSize: '40px' }}>👑</span>}
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: tealColor }}>{team.name}</div>
                        {isWinner && <div style={{ color: orangeColor, fontWeight: 'bold' }}>WINNER!</div>}
                        {isMyTeam && !isWinner && <div style={{ color: tealColor, fontWeight: 'bold' }}>Your Team</div>}
                      </div>
                    </div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: orangeColor }}>{team.score}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: 'center', marginTop: '30px', color: '#666', fontSize: '16px' }}>
              Thanks for playing Quizzler!
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }
 
  return null; 
  }