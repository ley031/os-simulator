//App

import React, { useState, useEffect, useRef } from 'react';
import Menu from './components/Menu';
import MemoryManagement from './components/MemoryManagement';

const colors = [
  '#FFA182', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6', 
  '#FFD876', '#3366E6', '#999966', '#99FF99', '#B34D4D',
  '#C1E762', '#809900', '#E6B3B3', '#6680B3', '#66991A', 
  '#FFBDEF', '#CCFF1A', '#FF1A66', '#E6331A', '#33FFCC',
  '#A2C093', '#B366CC', '#4D8000', '#B33300', '#CC80CC', 
  '#CECEC0', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399',
  '#FF51BA', '#33991A', '#CC9999', '#B3B31A', '#00E680', 
  '#3DC982', '#809980', '#E6FF80', '#1AFF33', '#999933',
  '#FF3380', '#CCCC00', '#66E64D', '#4D80CC', '#9900B3', 
  '#E64D66', '#4DB380', '#FF4D4D', '#99E6E6', '#6666FF'
];

const generateProcess = (id, currentTime) => {
  return {
    id,
    burstTime: Math.floor(Math.random() * 10) + 1, // Generates burst time between 1 and 10
    memorySize: Math.floor(Math.random() * 31) + 80, // Generates memory size between 80 and 110
    arrivalTime: currentTime, // Arrival time is set to the current timer value
    priority: Math.floor(Math.random() * 10) + 1,
    status: 'New',
    color: colors[id % colors.length],
    quantumLeft: 0
  };
};

const App = () => {
  const [policy, setPolicy] = useState('');
  const [isPlaying, setIsPlaying] = useState(false); // New state for play/pause
  const [processes, setProcesses] = useState([]);
  const [memory, setMemory] = useState(new Array(100).fill(null));
  
  const [jobQueue, setJobQueue] = useState([]);
  const [key, setKey] = useState(0); // Add a key state
  const [timer, setTimer] = useState(0); // Timer state
  const processIdRef = useRef(1);
  const currentTimeRef = useRef(0); // Reference to keep track of current time
  const nextArrivalTimeRef = useRef(0); // Reference to the next arrival time
  const timerIntervalRef = useRef(null); // Reference to the timer interval
  const quantum = 2; // Define the time quantum for RR policy
  const [readyQueue, setReadyQueue] = useState([]);

  useEffect(() => {
    if (policy && isPlaying) {
      timerIntervalRef.current = setInterval(() => {
        // Increment the timer
        setTimer(prevTimer => prevTimer + 1);
        currentTimeRef.current += 1;

        // Check if it's time to generate a new process
        if (currentTimeRef.current >= nextArrivalTimeRef.current) {
          const newProcess = generateProcess(processIdRef.current, currentTimeRef.current);
          processIdRef.current += 1;
          setProcesses(prevProcesses => [...prevProcesses, newProcess]);
          nextArrivalTimeRef.current = currentTimeRef.current + Math.floor(Math.random() * 5) + 1; // Set the next arrival time
        }

        runProcess();
      }, 1000); // Run the scheduler every second

      return () => clearInterval(timerIntervalRef.current);
    }
  }, [policy, isPlaying]);

  const handleSelectPolicy = (selectedPolicy) => {
    setPolicy(selectedPolicy);
    setIsPlaying(false);
    setProcesses([]);
    setMemory(new Array(100).fill(null));
    setJobQueue([]);
    processIdRef.current = 1;
    currentTimeRef.current = 0;
    nextArrivalTimeRef.current = 0; // Reset next arrival time
    setKey(prevKey => prevKey + 1);
    setTimer(0); // Reset the timer
  };

  const runProcess = () => {
    setProcesses((prevProcesses) => {
      const updatedProcesses = prevProcesses.map(process => ({ ...process }));

      if (policy === 'FCFS') {
        // FCFS policy
        const runningProcess = updatedProcesses.find(p => p.status === 'Running');
        if (runningProcess) {
          runningProcess.burstTime -= 1;
          if (runningProcess.burstTime <= 0) {
            runningProcess.status = 'Terminated';
            deallocateMemory(runningProcess);
          }
        } else {
          const nextProcess = updatedProcesses.find(p => p.status === 'Ready' && p.arrivalTime <= currentTimeRef.current);
          if (nextProcess) {
            nextProcess.status = 'Running';
          }
        }

      } else if (policy === 'SJF') {
        // SJF Preemptive policy
        const runningProcess = updatedProcesses.find(p => p.status === 'Running');
        const readyProcesses = updatedProcesses.filter(p => p.status === 'Ready' && p.arrivalTime <= currentTimeRef.current);

        if (runningProcess) {
          runningProcess.burstTime -= 1;
          if (runningProcess.burstTime <= 0) {
            runningProcess.status = 'Terminated';
            deallocateMemory(runningProcess);
          }
        }

        if (readyProcesses.length > 0) {
          const shortestJob = readyProcesses.sort((a, b) => a.burstTime - b.burstTime)[0];
          if (runningProcess) {
            if (shortestJob.burstTime < runningProcess.burstTime) {
              runningProcess.status = 'Ready';
              shortestJob.status = 'Running';
            }
          } else {
            shortestJob.status = 'Running';
          }
        }

      } else if (policy === 'Priority') {
        // Priority Preemptive policy
        const runningProcess = updatedProcesses.find(p => p.status === 'Running');
        const readyProcesses = updatedProcesses.filter(p => p.status === 'Ready' && p.arrivalTime <= currentTimeRef.current);
        if (runningProcess) {
          runningProcess.burstTime -= 1;
          if (runningProcess.burstTime <= 0) {
            runningProcess.status = 'Terminated';
            deallocateMemory(runningProcess);
          } else {
            const highestPriorityProcess = readyProcesses.sort((a, b) => a.priority - b.priority)[0];
            if (highestPriorityProcess && highestPriorityProcess.priority < runningProcess.priority) {
              runningProcess.status = 'Ready';
              highestPriorityProcess.status = 'Running';
            }
          }
        } else {
          if (readyProcesses.length > 0) {
            const highestPriorityProcess = readyProcesses.sort((a, b) => a.priority - b.priority)[0];
            highestPriorityProcess.status = 'Running';
          }
        }

      } else if (policy === 'RR') {
        const currentReadyQueue = [...readyQueue];
        
        // Add new arriving processes to the ready queue
        updatedProcesses.forEach(process => {
          if (process.status === 'Ready' && process.arrivalTime <= currentTimeRef.current && !currentReadyQueue.includes(process.id)) {
            currentReadyQueue.push(process.id);
          }
        });
  
        if (currentReadyQueue.length > 0) {
          const runningProcessId = currentReadyQueue.shift();
          const runningProcess = updatedProcesses.find(p => p.id === runningProcessId);
  
          if (runningProcess) {
            runningProcess.status = 'Running';
            runningProcess.burstTime -= 1;
            runningProcess.quantumLeft = (runningProcess.quantumLeft || quantum) - 1;
  
            if (runningProcess.burstTime <= 0) {
              runningProcess.status = 'Terminated';
              deallocateMemory(runningProcess);
            } else if (runningProcess.quantumLeft <= 0) {
              runningProcess.status = 'Ready';
              runningProcess.quantumLeft = quantum; // Reset quantum time
              currentReadyQueue.push(runningProcess.id);
            } else {
              currentReadyQueue.unshift(runningProcess.id); // Still has quantum left, re-add to front of queue
            }
          }
        }
  
        setReadyQueue(currentReadyQueue);
      }
  

      // Check if there are processes in the job queue that can be allocated memory
      const updatedJobQueue = [];
      for (const process of jobQueue) {
        const freeSpaces = []; // Array to store available spaces
        let currentBlockSize = 0; // Variable to track the size of the current free space
        let bestFitIndex = -1; // Index of the best fit block
        let bestFitSize = Infinity; // Size of the best fit block

        // Iterate through memory to find available spaces
        for (let i = 0; i < memory.length; i++) {
          if (memory[i] === null) {
            currentBlockSize++; // Increase the size of the current free space
            if (currentBlockSize >= process.memorySize) { // If current free space is large enough
              if (currentBlockSize < bestFitSize) { // Check if it's the best fit so far
                bestFitIndex = i - currentBlockSize + 1; // Update best fit index
                bestFitSize = currentBlockSize; // Update best fit size
              }
            }
          } else {
            currentBlockSize = 0; // Reset the current free space size
          }
        }

        // If a best fit block is found
        if (bestFitIndex !== -1) {
          const newMemory = [...memory];
          for (let i = bestFitIndex; i < bestFitIndex + process.memorySize; i++) {
            newMemory[i] = process.id; // Allocate memory for the process
          }
          setMemory(newMemory);
          process.status = 'Ready'; // Update the process status to 'Ready'
          updatedProcesses.push(process);
        } else {
          // If no suitable block is found, keep the process in the job queue
          updatedJobQueue.push(process);
        }
      }
      setJobQueue(updatedJobQueue);

      return updatedProcesses;
    });
  };

  

  const handlePlayPause = (play) => {
    setIsPlaying(play);
    if (!play && timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  };

  const handleNext = () => {
    // Run one step of the simulation
    setTimer((prevTimer) => prevTimer + 1);
    currentTimeRef.current += 1;
  
    // Check if it's time to generate a new process
    if (currentTimeRef.current >= nextArrivalTimeRef.current) {
      const newProcess = generateProcess(processIdRef.current, currentTimeRef.current);
      processIdRef.current += 1;
      setProcesses((prevProcesses) => [...prevProcesses, newProcess]);
      nextArrivalTimeRef.current = currentTimeRef.current + Math.floor(Math.random() * 5) + 1; // Set the next arrival time
    }
  
    runProcess();
  };
  
  const deallocateMemory = (process) => {
    setMemory((prevMemory) => {
      const newMemory = prevMemory.map((unit) => (unit === process.id ? null : unit));
      setMemory(newMemory); // Update parent component's memory state
      return newMemory;
    });
  };

  const handleDelete = () => {
    setProcesses((prevProcesses) => {
      const updatedProcesses = [...prevProcesses];
      const deletedProcess = updatedProcesses.pop(); // Remove the last process
      if (deletedProcess) {
        deallocateMemory(deletedProcess); // Deallocate memory for the deleted process
      }
      return updatedProcesses;
    });
  };


  const handleReset = () => {
    setIsPlaying(false);
    setProcesses([]);
    setMemory(new Array(100).fill(null));
    setJobQueue([]);
    processIdRef.current = 1;
    currentTimeRef.current = 0;
    nextArrivalTimeRef.current = 0;
    setKey(prevKey => prevKey + 1);
    setTimer(0);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  };

  const handleAddProcess = () => {
    const newProcess = generateProcess(processIdRef.current, currentTimeRef.current);
    processIdRef.current += 1;
    setProcesses(prevProcesses => [...prevProcesses, newProcess]);
  };
  

  return (
    <div>
      <Menu onSelectPolicy={handleSelectPolicy} onPlayPause={handlePlayPause} onNext={handleNext} onReset={handleReset} onDelete={handleDelete} onAddProcess={handleAddProcess} isPlaying={isPlaying} />
      <div>CPU Time: {timer}s</div>
      {policy && <h3>Current Policy: {policy}</h3>}

      <MemoryManagement
        key={key}
        processes={processes}
        memory={memory}
        setMemory={setMemory}
        jobQueue={jobQueue}
        setJobQueue={setJobQueue}
      />
    </div>
  );

  
    

};

export default App;
