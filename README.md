# HoopViz 🏀

HoopViz is an **interactive**, **web based**, **data visualization** project designed to turn decades of dry **NBA statistics** into a **dynamic**, **interactive** and **visual** story.
While most basketball statistics sites feel like looking at a tax return, we want our project to mirror the fast-paced and playful energy of the game itself.

By using multiple seasons of data, we are building a "time-traveling" experience where users can slide through history to see how the league has evolved over the years with interesting transitions.

**Live demo: <https://com-480-data-visualization.github.io/HoopViz/>**

Project of Data Visualization (EPFL COM-480) - 2026

| Student's name | SCIPER |
| -------------- | ------ |
| Lucas Jung | 324724 |
| Anasse El Boudiri | 374212 |
| Sam Lee | 375535 |

## Deliverables

- [Milestone 1](./deliverables/ms1/ms1.md)
- [Milestone 2](./deliverables/ms2/ms2.pdf)
- [Milestone 3](./deliverables/ms3/ms3.md)

**Note**: Each deliverable comes with its associated GitHub release of the repository.

## Development setup

If you want to run the website locally it's very simple. The whole website is static so you can clone the repository and run an HTTP server in the `src` folder. There is no build step.

```bash
git clone https://github.com/com-480-data-visualization/HoopViz
cd HoopViz/src
python -m http.server
```

## Repository structure

- `data`: everything related to our dataset with instructions to reproduce it.
- `deliverables`: deliverables for the EPFL COM-480 course.
- `scripts`: code we wrote to explore the data or pre-process it.
- `src`: code for the visualization website.
