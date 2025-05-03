import React, { useEffect, useState } from 'react';
import { View, Text, Dimensions, ScrollView } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useTrip } from '../context/TripContext';
import { format } from 'date-fns';

const screenWidth = Dimensions.get('window').width;

export default function VisualisationScreen() {
  const { tripHistory } = useTrip();
  const [weeklyData, setWeeklyData] = useState<number[]>([]);
  const [monthlyData, setMonthlyData] = useState<number[]>([]);
  const [weekLabels, setWeekLabels] = useState<string[]>([]);
  const [monthLabels, setMonthLabels] = useState<string[]>([]);

  useEffect(() => {
    const now = new Date();
    const oneDay = 1000 * 60 * 60 * 24;

    // Past 7 days
    const pastWeek = Array.from({ length: 7 }).map((_, i) => {
      const day = new Date(now.getTime() - oneDay * (6 - i));
      return {
        label: format(day, 'EEE'),
        dayStart: new Date(day.setHours(0, 0, 0, 0)).getTime(),
        dayEnd: new Date(day.setHours(23, 59, 59, 999)).getTime()
      };
    });

    const weekEmissions = pastWeek.map(({ dayStart, dayEnd }) => {
      return tripHistory
        .filter(trip => {
          const time = new Date(trip.startTime).getTime();
          return time >= dayStart && time <= dayEnd;
        })
        .reduce((sum, trip) => sum + (trip.carbonEmissions || 0), 0);
    });

    setWeeklyData(weekEmissions);
    setWeekLabels(pastWeek.map(d => d.label));

    // Past 30 days
    const pastMonth = Array.from({ length: 4 }).map((_, i) => {
      const start = new Date(now.getTime() - oneDay * (28 - i * 7));
      const end = new Date(start.getTime() + oneDay * 6);
      return {
        label: `W${i + 1}`,
        startTime: start.getTime(),
        endTime: end.getTime()
      };
    });

    const monthEmissions = pastMonth.map(({ startTime, endTime }) => {
      return tripHistory
        .filter(trip => {
          const time = new Date(trip.startTime).getTime();
          return time >= startTime && time <= endTime;
        })
        .reduce((sum, trip) => sum + (trip.carbonEmissions || 0), 0);
    });

    setMonthlyData(monthEmissions);
    setMonthLabels(pastMonth.map(m => m.label));
  }, [tripHistory]);

  return (
    <ScrollView className="flex-1 bg-white p-4">
      <Text className="text-xl font-bold mb-4">Carbon Emissions Overview</Text>

      <Text className="text-lg font-semibold mt-4 mb-2">Past Week</Text>
      <LineChart
        data={{
          labels: weekLabels,
          datasets: [{ data: weeklyData }],
        }}
        width={screenWidth - 32}
        height={220}
        fromZero
        yAxisSuffix="kg"
        chartConfig={{
          backgroundColor: '#ffffff',
          backgroundGradientFrom: '#e5f0ff',
          backgroundGradientTo: '#cce0ff',
          color: () => '#005eff',
          labelColor: () => '#333',
        }}
        style={{
          borderRadius: 12,
        }}
      />

      <Text className="text-lg font-semibold mt-6 mb-2">Past Month</Text>
      <LineChart
        data={{
          labels: monthLabels,
          datasets: [{ data: monthlyData }],
        }}
        width={screenWidth - 32}
        height={220}
        yAxisSuffix="kg"
        fromZero
        chartConfig={{
          backgroundColor: '#ffffff',
          backgroundGradientFrom: '#fff0f5',
          backgroundGradientTo: '#ffe6f0',
          color: () => '#ff4081',
          labelColor: () => '#333',
        }}
        style={{
          borderRadius: 12,
        }}
      />
    </ScrollView>
  );
}
